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

const UA =
  "Mozilla/5.0 (compatible; PennNotesBot/1.0; +https://github.com/lp-Imagine/vuepressblog)";

const parser = new Parser({
  timeout: 20000,
  headers: {
    "User-Agent": UA,
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

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

function itemDate(item) {
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

async function fetchExcerpt(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
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

async function fetchGithubTrending(targetDate) {
  const items = [];
  try {
    const res = await fetch("https://github.com/trending?since=daily", {
      headers: {
        "User-Agent": UA,
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
      });
      n++;
    }
  } catch (err) {
    console.warn("[trending]", err.message || err);
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
  const window = dateWindow(targetDate, lookbackDays);
  const seen = loadSeen();
  const seenSet = new Set(seen.urls);
  const failures = [];
  const collected = [];

  await Promise.all(
    sources.map(async (src) => {
      try {
        const feed = await parser.parseURL(src.url);
        for (const item of feed.items || []) {
          const url = normalizeUrl(item.link || item.guid || "");
          if (!url) continue;
          const date = itemDate(item);
          // Undated: keep if recent enough via feed order — skip undated
          if (date && !window.has(date)) continue;
          if (!date) continue;
          if (!opts.includeSeen && seenSet.has(url)) continue;
          collected.push({
            title: (item.title || "Untitled").trim(),
            url,
            sourceName: src.name,
            sourceId: src.id,
            section: src.section,
            date,
            snippet: stripHtml(
              item.contentSnippet || item.summary || item.content || "",
            ).slice(0, 600),
            excerpt: "",
          });
        }
      } catch (err) {
        failures.push({
          id: src.id,
          name: src.name,
          error: String(err.message || err),
        });
      }
    }),
  );

  const trending = await fetchGithubTrending(targetDate);
  for (const it of trending) {
    if (!opts.includeSeen && seenSet.has(it.url)) continue;
    collected.push(it);
  }

  const byUrl = new Map();
  for (const it of collected) {
    if (!byUrl.has(it.url)) byUrl.set(it.url, it);
  }
  let items = [...byUrl.values()];

  // Prefer items on targetDate, then fill with lookback
  items.sort((a, b) => {
    const aScore = a.date === targetDate ? 0 : 1;
    const bScore = b.date === targetDate ? 0 : 1;
    if (aScore !== bScore) return aScore - bScore;
    return a.date < b.date ? 1 : -1;
  });
  items = items.slice(0, 36);

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

  return {
    items,
    failures,
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
