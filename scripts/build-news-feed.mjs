#!/usr/bin/env node
/**
 * Build RSS 2.0 feed for AI 动态 → website/public/news/feed.xml
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://lp-imagine.github.io/vuepressblog";

function siteUrl(path = "") {
  const p = String(path).replace(/^\/+/, "");
  return p ? `${SITE}/${p}` : `${SITE}/`;
}
const OUT = path.join(root, "website/public/news/feed.xml");
const ITEMS_JSON = path.join(root, "website/.vitepress/news-items.generated.json");

function escapeXml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc822(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 16, 0, 0)).toUTCString();
}

/**
 * @param {Array<{title:string, section:string, sourceName:string, itemDate:string, digestLink:string, digestDate:string, summary?:string}>} items
 */
export function buildNewsFeedXml(items, opts = {}) {
  const limit = opts.limit ?? 40;
  const slice = items.slice(0, limit);
  const lastBuild = new Date().toUTCString();

  const channelItems = slice
    .map((item) => {
      const link = siteUrl(item.digestLink.replace(/^\//, ""));
      const desc = [
        item.section ? `[${item.section}]` : "",
        item.sourceName ? `来源：${item.sourceName}` : "",
        item.summary || "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${toRfc822(item.itemDate || item.digestDate)}</pubDate>
      <description>${escapeXml(desc)}</description>
      <category>${escapeXml(item.section)}</category>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Penn Notes · AI 动态</title>
    <link>${siteUrl("news/")}</link>
    <description>每日 AI 与前端精选动态 —— Penn Notes</description>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <generator>Penn Notes news feed</generator>
${channelItems}
  </channel>
</rss>
`;
}

export function writeNewsFeed(items) {
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const key = item.sourceUrl || item.title;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const xml = buildNewsFeedXml(unique);
  fs.writeFileSync(OUT, xml, "utf8");
  return OUT;
}

function main() {
  let items = [];
  if (fs.existsSync(ITEMS_JSON)) {
    items = JSON.parse(fs.readFileSync(ITEMS_JSON, "utf8"));
  }
  const out = writeNewsFeed(items);
  console.log(`build-news-feed: ${items.length} item(s) → ${path.relative(root, out)}`);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) main();
