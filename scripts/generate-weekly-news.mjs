#!/usr/bin/env node
/**
 * Compile weekly digest from recent daily digests (no extra LLM call).
 *
 *   node scripts/generate-weekly-news.mjs
 *   node scripts/generate-weekly-news.mjs --date=2026-07-27 --force
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDigestMarkdown } from "./news/parse-digest.mjs";
import {
  dateRangeEnd,
  monthOf,
  NEWS_SECTIONS,
  renderWeeklyMarkdown,
  shanghaiYesterday,
} from "./news/sections.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const newsRoot = path.join(root, "news");
const PER_SECTION = 3;

function parseArgs(argv) {
  const out = { date: null, force: false };
  for (const a of argv) {
    if (a.startsWith("--date=")) out.date = a.slice(7);
    else if (a === "--force") out.force = true;
  }
  return out;
}

function listDailyDigestsInRange(dates) {
  const set = new Set(dates);
  const files = [];
  if (!fs.existsSync(newsRoot)) return files;
  for (const month of fs.readdirSync(newsRoot)) {
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const dir = path.join(newsRoot, month);
    for (const file of fs.readdirSync(dir)) {
      if (!file.startsWith("ai-news-") || file.includes("week")) continue;
      const m = file.match(/ai-news-(\d{4}-\d{2}-\d{2})\.md$/);
      if (!m || !set.has(m[1])) continue;
      files.push({ month, file, date: m[1], path: path.join(dir, file) });
    }
  }
  files.sort((a, b) => (a.date < b.date ? -1 : 1));
  return files;
}

function pickWeeklyItems(allItems) {
  const bySection = Object.fromEntries(NEWS_SECTIONS.map((s) => [s, []]));
  const seenUrl = new Set();

  const sorted = [...allItems].sort((a, b) => {
    if (a.itemDate !== b.itemDate) return a.itemDate < b.itemDate ? 1 : -1;
    return 0;
  });

  for (const item of sorted) {
    const sec = item.section;
    if (!NEWS_SECTIONS.includes(sec)) continue;
    const key = item.sourceUrl || item.title;
    if (seenUrl.has(key)) continue;
    if (bySection[sec].length >= PER_SECTION) continue;
    seenUrl.add(key);
    bySection[sec].push({
      title: item.title,
      summary: item.summary || "",
      sourceName: item.sourceName,
      url: item.sourceUrl,
      date: item.itemDate,
      image: item.image || null,
    });
  }

  return bySection;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const weekEnd = args.date || shanghaiYesterday();
  const weekDates = dateRangeEnd(weekEnd, 7);
  const weekStart = weekDates[0];
  const month = monthOf(weekEnd);
  const outFile = path.join(newsRoot, month, `ai-news-week-${weekEnd}.md`);

  if (fs.existsSync(outFile) && !args.force) {
    console.log(`Skip: ${path.relative(root, outFile)} exists (use --force)`);
    return;
  }

  const digests = listDailyDigestsInRange(weekDates);
  if (!digests.length) {
    console.log(`No daily digests in ${weekStart} ~ ${weekEnd}, skip weekly`);
    return;
  }

  const allItems = [];
  for (const d of digests) {
    const content = fs.readFileSync(d.path, "utf8");
    const slug = d.file.replace(/\.md$/, "");
    allItems.push(
      ...parseDigestMarkdown(content, {
        date: d.date,
        month: d.month,
        slug,
        link: `/news/${d.month}/${slug}`,
      }),
    );
  }

  const bySection = pickWeeklyItems(allItems);
  const total = Object.values(bySection).reduce((n, a) => n + a.length, 0);
  if (!total) {
    console.log("No items for weekly digest, skip");
    return;
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, renderWeeklyMarkdown(weekStart, weekEnd, bySection), "utf8");
  console.log(
    `Wrote ${path.relative(root, outFile)} (${total} items from ${digests.length} daily digest(s))`,
  );
}

main();
