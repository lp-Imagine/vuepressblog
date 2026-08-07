/**
 * Fetch RSS + GitHub Trending, lookback window, enrich with page excerpts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Parser from "rss-parser";
import { dateWindow, shanghaiDate } from "./news/sections.mjs";
import { assertNodeVersion, fetch } from "./news/http.mjs";

assertNodeVersion(18);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcesPath = path.join(root, "scripts/news/sources.json");
const statePath = path.join(root, "news/.state/seen-urls.json");
const healthPath = path.join(root, "news/.state/feed-health.json");

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const parser = new Parser({
  timeout: 20000,
  headers: {
    "User-Agent": BROWSER_UA,
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  },
});

async function fetchFeedText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Status code ${res.status}`);
  const text = await res.text();
  if (!/<(rss|feed|rdf:RDF)\b/i.test(text)) {
    throw new Error("Feed not recognized as RSS/Atom");
  }
  return text;
}

async function parseSourceFeed(src) {
  const urls = [src.url, ...(src.fallbackUrls || [])].filter(Boolean);
  let lastErr = null;
  for (const url of urls) {
    try {
      const text = await fetchFeedText(url);
      const feed = await parser.parseString(text);
      return { feed, url };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Feed fetch failed");
}

function saveFeedHealth(report) {
  fs.mkdirSync(path.dirname(healthPath), { recursive: true });
  fs.writeFileSync(healthPath, JSON.stringify(report, null, 2) + "\n", "utf8");
}

function loadSeen() {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return { urls: [] };
  }
}

function saveSeen(seen) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const urls = [...new Set(seen.urls)].slice(-5000);
  fs.writeFileSync(statePath, JSON.stringify({ urls }, null, 2) + "\n");
}

export function itemDate(item) {
  const raw = item.isoDate || item.pubDate || item.published || "";
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return shanghaiDate(d);
}

function normalizeUrl(u) {
  try {
    const url = new URL(u);
    url.hash = "";
    return url.toString();
  } catch {
    return String(u || "").trim();
  }
}

function stripHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchExcerpt(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    const desc =
      html.match(
        /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i,
      )?.[1] ||
      html.match(
        /content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i,
      )?.[1] ||
      "";
    const body = stripHtml(html).slice(0, 1800);
    return [decodeEntities(desc), body].filter(Boolean).join("\n").slice(0, 2200);
  } catch {
    return "";
  }
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function fetchGithubTrending(targetDate, trendingOrder) {
  const items = [];
  try {
    const res = await fetch("https://github.com/trending?since=daily", {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return items;
    const html = await res.text();
    const re =
      /href="\/([^"/]+\/[^"/]+)"[^>]*>\s*<span[^>]*>\s*([^<]+)\s*<\/span>\s*\/\s*<span[^>]*>\s*([^<]+)/gi;
    // Simpler: article.h3 links
    const repoRe =
      /<h2[^>]*>[\s\S]*?<a[^>]+href="\/([^"/]+\/[^"/]+)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<\/h2>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi;
    let m;
    let n = 0;
    while ((m = repoRe.exec(html)) && n < 12) {
      const repo = m[1];
      const desc = stripHtml(m[2] || "").slice(0, 280);
      // Prefer AI-related
      const hay = `${repo} ${desc}`.toLowerCase();
      const aiish =
        /ai|llm|gpt|agent|mcp|openai|claude|langchain|transformer|rag|cursor|copilot/.test(
          hay,
        );
      if (!aiish && n >= 4) continue;
      items.push({
        title: repo,
        url: `https://github.com/${repo}`,
        sourceName: repo,
        sourceId: "github-trending",
        section: "开源",
        date: targetDate,
        snippet: desc || `GitHub Trending: ${repo}`,
        excerpt: desc,
        _order: trendingOrder,
        _seq: n,
      });
      n++;
    }
  } catch (err) {
    console.warn("[trending]", err.message || err);
  }
  return items;
}

/**
 * Hacker News via Algolia API.
 *
 * hnrss.org is rate-limited / 502-prone, and the official HN front-page RSS
 * has no pubDate, so we pull the latest dated stories from the Algolia API
 * and keep the AI-related ones.
 */
async function fetchHnAlgolia(src, window, seenSet, includeSeen) {
  const items = [];
  const res = await fetch(
    "https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=100",
    {
      headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!res.ok) throw new Error(`Status code ${res.status}`);
  const data = await res.json();
  for (const hit of data.hits || []) {
    const title = String(hit.title || "").trim();
    if (!title) continue;
    const hay = `${title} ${hit.url || ""}`.toLowerCase();
    if (
      !/ai|llm|gpt|claude|openai|anthropic|agent|mcp|gemini|llama|deepseek|qwen|neural|machine learning|deep learning/.test(
        hay,
      )
    )
      continue;
    const link = normalizeUrl(
      hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
    );
    if (!link) continue;
    const date = itemDate({ isoDate: hit.created_at });
    if (!date || !window.has(date)) continue;
    if (!includeSeen && seenSet.has(link)) continue;
    items.push({
      title,
      url: link,
      sourceName: "Hacker News",
      sourceId: src.id,
      section: src.section,
      date,
      snippet: `${hit.points ?? 0} points · ${hit.num_comments ?? 0} comments`,
      excerpt: "",
    });
  }
  return items;
}

/**
 * @param {string} targetDate YYYY-MM-DD
 * @param {{ includeSeen?: boolean, lookbackDays?: number, enrich?: boolean }} [opts]
 */
export async function fetchNewsItems(targetDate, opts = {}) {
  const cfg = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
  const sources = cfg.sources || [];
  const lookbackDays = opts.lookbackDays ?? cfg.lookbackDays ?? 3;
  const maxCandidates = opts.maxCandidates ?? cfg.maxCandidates ?? 64;
  const maxItemsPerSource = cfg.maxItemsPerSource ?? 6;
  const window = dateWindow(targetDate, lookbackDays);
  const seen = loadSeen();
  const seenSet = new Set(seen.urls);
  const failures = [];
  const successes = [];
  const collected = [];
  const srcIndex = new Map(sources.map((s, i) => [s.id, i]));
  const trendingOrder = sources.length;

  await Promise.all(
    sources.map(async (src) => {
      try {
        if (src.type === "hn-algolia") {
          const algoliaItems = await fetchHnAlgolia(
            src,
            window,
            seenSet,
            opts.includeSeen,
          );
          algoliaItems.forEach((it, idx) => {
            collected.push({
              ...it,
              _order: srcIndex.get(src.id) ?? 999,
              _seq: idx,
            });
          });
          successes.push({
            id: src.id,
            name: src.name,
            url: "https://hn.algolia.com/api/v1",
            items: algoliaItems.length,
          });
          return;
        }
        const { feed, url } = await parseSourceFeed(src);
        let count = 0;
        let idx = 0;
        for (const item of feed.items || []) {
          const link = normalizeUrl(item.link || item.guid || "");
          if (!link) continue;
          const date = itemDate(item);
          // Undated items can't be pinned to a report day — skip
          if (!date) continue;
          if (!window.has(date)) continue;
          if (!opts.includeSeen && seenSet.has(link)) continue;
          count++;
          collected.push({
            title: (item.title || "Untitled").trim(),
            url: link,
            sourceName: src.name,
            sourceId: src.id,
            section: src.section,
            date,
            snippet: stripHtml(
              item.contentSnippet || item.summary || item.content || "",
            ).slice(0, 600),
            excerpt: "",
            _order: srcIndex.get(src.id) ?? 999,
            _seq: idx,
          });
          idx++;
        }
        successes.push({ id: src.id, name: src.name, url, items: count });
      } catch (err) {
        failures.push({
          id: src.id,
          name: src.name,
          error: String(err.message || err),
        });
      }
    }),
  );

  const trending = await fetchGithubTrending(targetDate, trendingOrder);
  for (const it of trending) {
    if (!opts.includeSeen && seenSet.has(it.url)) continue;
    collected.push(it);
  }

  const byUrl = new Map();
  for (const it of collected) {
    if (!byUrl.has(it.url)) byUrl.set(it.url, it);
  }
  let items = [...byUrl.values()];

  // Deterministic order: targetDate first, then older; tie-break by source
  // order (sources.json) and feed position so the final cut is reproducible.
  items.sort((a, b) => {
    const aScore = a.date === targetDate ? 0 : 1;
    const bScore = b.date === targetDate ? 0 : 1;
    if (aScore !== bScore) return aScore - bScore;
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a._order !== b._order) return a._order - b._order;
    return a._seq - b._seq;
  });

  // Per-source quota so one high-volume feed (36kr, arXiv, GitHub Trending…)
  // can't flood the candidate pool, then a global cap for the LLM prompt.
  const perSource = new Map();
  const quotted = [];
  for (const it of items) {
    const sid = it.sourceId;
    const used = perSource.get(sid) ?? 0;
    if (used >= maxItemsPerSource) continue;
    perSource.set(sid, used + 1);
    quotted.push(it);
  }
  items = quotted.slice(0, maxCandidates);
  for (const it of items) {
    delete it._order;
    delete it._seq;
  }

  if (opts.enrich !== false) {
    console.log(`Enriching ${items.length} article excerpt(s)...`);
    const concurrency = 5;
    let i = 0;
    async function worker() {
      while (i < items.length) {
        const idx = i++;
        const it = items[idx];
        if (it.excerpt && it.excerpt.length > 80) continue;
        const ex = await fetchExcerpt(it.url);
        if (ex) it.excerpt = ex;
      }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  }

  saveFeedHealth({
    at: new Date().toISOString(),
    targetDate,
    ok: successes.length,
    failed: failures.length,
    successes,
    failures,
  });

  return {
    items,
    failures,
    successes,
    seen,
    saveSeen: () => {
      for (const it of items) seen.urls.push(it.url);
      saveSeen(seen);
    },
  };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const dateArg = process.argv.find((a) => a.startsWith("--date="));
  const { shanghaiYesterday } = await import("./news/sections.mjs");
  const date = dateArg ? dateArg.slice(7) : shanghaiYesterday();
  const { items, failures } = await fetchNewsItems(date, { enrich: false });
  console.log(`Fetched ${items.length} items for ${date}`);
  if (failures.length) console.log("Failures:", failures);
  console.log(JSON.stringify(items.slice(0, 5), null, 2));
}
