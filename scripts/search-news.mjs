/**
 * 联网检索 + 核验。
 *
 * 用 Google News RSS 对 AI 关键词做实时搜索，逐条回源抓页面验证可达
 * （抓不到 / 非文章页的丢弃），顺带抽取 og:description 作为 excerpt。
 * 作为 RSS 之外的外国一手新闻补充。
 *
 * 注意：Google News 需要能访问 google.com 的网络（GitHub Actions 正常）；
 * 本地不可达时会自动跳过，不影响 RSS 日报生成。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Parser from "rss-parser";
import { dateWindow } from "./news/sections.mjs";
import { fetch } from "./news/http.mjs";
import { itemDate, fetchExcerpt } from "./fetch-rss.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcesPath = path.join(root, "scripts/news/sources.json");

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const parser = new Parser({
  timeout: 20000,
  headers: {
    "User-Agent": BROWSER_UA,
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
  },
  customFields: {
    item: [["source", "source", { includeSnippet: true }]],
  },
});

const SECTION_RULES = [
  {
    section: "模型",
    re: /llm|gpt|claude|gemini|llama|mistral|deepseek|qwen|model|benchmark|inference|weights|paper|research/i,
  },
  {
    section: "产品",
    re: /launch|app |feature|product|pricing|chatgpt|copilot|release|announc|update/i,
  },
  {
    section: "开发者工具",
    re: /developer|sdk|api|agent|code |coding|ide|mcp|framework|tool|command-line|cli/i,
  },
  {
    section: "开源",
    re: /open[- ]?source|github|hugging ?face|apache|license|repository|repo/i,
  },
  {
    section: "前端",
    re: /frontend|web |css|javascript|react|browser|typescript/i,
  },
];

export function guessSection(title) {
  const t = String(title || "");
  for (const rule of SECTION_RULES) {
    if (rule.re.test(t)) return rule.section;
  }
  return "业界";
}

function publisherOf(item) {
  const src = item.source;
  const direct =
    typeof src === "string" ? src : src?._ || src?.name || src?.[0]?._ || "";
  if (direct && String(direct).trim()) return String(direct).trim();
  const m = String(item.title || "").match(/^(.*?)\s+-\s+([^-]+)$/);
  return m ? m[2].trim() : "";
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {string} targetDate YYYY-MM-DD
 * @param {{ seenUrls?: string[] }} [opts]
 */
export async function searchNewsItems(targetDate, opts = {}) {
  const cfg = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
  const searchCfg = cfg.search || {};
  if (searchCfg.enabled === false) {
    return {
      items: [],
      ok: false,
      queries: 0,
      totalQueries: 0,
      failures: [{ query: "*", error: "search disabled in sources.json" }],
    };
  }
  const queries = searchCfg.queries || [];
  const whenDays = searchCfg.whenDays ?? 2;
  const hitsPerQuery = searchCfg.hitsPerQuery ?? 15;
  const maxItems = searchCfg.maxItems ?? 16;
  const window = dateWindow(targetDate, cfg.lookbackDays ?? 3);
  const seen = new Set((opts.seenUrls || []).map(String));

  const collected = [];
  const failures = [];
  let queriesOk = 0;

  await Promise.all(
    queries.map(async (q) => {
      try {
        const url =
          "https://news.google.com/rss/search?q=" +
          encodeURIComponent(`${q} when:${whenDays}d`) +
          "&hl=en-US&gl=US&ceid=US:en";
        const res = await fetch(url, {
          headers: {
            "User-Agent": BROWSER_UA,
            Accept: "application/rss+xml, application/xml, */*",
          },
          redirect: "follow",
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const feed = await parser.parseString(await res.text());
        queriesOk++;
        let n = 0;
        for (const item of feed.items || []) {
          if (n >= hitsPerQuery) break;
          const link = String(item.link || "").trim();
          if (!link) continue;
          const date = itemDate(item);
          if (!date || !window.has(date)) continue;
          if (seen.has(link)) continue;
          const publisher = publisherOf(item);
          let title = String(item.title || "Untitled").trim();
          if (publisher) {
            title = title
              .replace(
                new RegExp(`\\s+-\\s+${escapeRegExp(publisher)}$`),
                "",
              )
              .trim();
          }
          collected.push({
            title: title || "Untitled",
            url: link,
            sourceName: publisher || "Google News 检索",
            sourceId: "google-news-search",
            section: guessSection(title),
            date,
            snippet: String(item.contentSnippet || item.summary || "").slice(
              0,
              400,
            ),
            excerpt: "",
          });
          n++;
        }
      } catch (err) {
        failures.push({ query: q, error: String(err.message || err) });
      }
    }),
  );

  const byUrl = new Map();
  for (const it of collected) {
    if (!byUrl.has(it.url)) byUrl.set(it.url, it);
  }
  let candidates = [...byUrl.values()];

  // 核验：回源抓页面，抓不到 / 非文章页的丢弃；成功则顺带拿到 excerpt。
  let i = 0;
  const verified = [];
  async function worker() {
    while (i < candidates.length) {
      const idx = i++;
      const it = candidates[idx];
      const ex = await fetchExcerpt(it.url);
      if (ex) {
        it.excerpt = ex;
        verified.push(it);
      }
    }
  }
  await Promise.all(Array.from({ length: 5 }, () => worker()));

  return {
    items: verified.slice(0, maxItems),
    ok: failures.length === 0,
    queries: queriesOk,
    totalQueries: queries.length,
    failures,
  };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const { shanghaiYesterday } = await import("./news/sections.mjs");
  const dateArg = process.argv.find((a) => a.startsWith("--date="));
  const date = dateArg ? dateArg.slice(7) : shanghaiYesterday();
  const cfg = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
  const totalQueries = cfg.search?.queries?.length ?? 0;
  const result = await searchNewsItems(date);
  console.log(
    `Search ok ${result.queries}/${totalQueries} queries, ${result.items.length} verified item(s) for ${date}`,
  );
  if (result.failures.length) {
    console.log("Failures:", result.failures);
  }
  console.log(JSON.stringify(result.items.slice(0, 5), null, 2));
}
