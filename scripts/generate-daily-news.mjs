#!/usr/bin/env node
/**
 * Generate yesterday's (or --date) AI news digest — AI-NEWS editorial style.
 *
 *   LLM_API_KEY=sk-xxx node scripts/generate-daily-news.mjs
 *   node scripts/generate-daily-news.mjs --date=2026-07-26 --force
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchNewsItems } from "./fetch-rss.mjs";
import { summarizeNews } from "./summarize-news.mjs";
import { resolveNewsImages } from "./resolve-news-images.mjs";
import {
  monthOf,
  renderDailyMarkdown,
  shanghaiYesterday,
} from "./news/sections.mjs";
import { assertNodeVersion } from "./news/http.mjs";

assertNodeVersion(18);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const out = {
    date: null,
    force: false,
    skipImages: false,
    skipSeen: false,
    allowHeuristic: false,
  };
  for (const a of argv) {
    if (a.startsWith("--date=")) out.date = a.slice(7);
    else if (a === "--force") out.force = true;
    else if (a === "--skip-images") out.skipImages = true;
    else if (a === "--include-seen") out.skipSeen = true;
    else if (a === "--allow-heuristic") out.allowHeuristic = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const reportDate = args.date || shanghaiYesterday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    throw new Error(`Invalid date: ${reportDate}`);
  }

  const month = monthOf(reportDate);
  const outDir = path.join(root, "news", month);
  const outFile = path.join(outDir, `ai-news-${reportDate}.md`);

  if (fs.existsSync(outFile) && !args.force) {
    console.log(
      `Skip: ${path.relative(root, outFile)} already exists (use --force)`,
    );
    process.exit(0);
  }

  console.log(`Generating daily news for ${reportDate} ...`);
  const { items, failures, successes, saveSeen } = await fetchNewsItems(reportDate, {
    includeSeen: args.skipSeen || args.force,
    enrich: true,
  });

  if (failures.length) {
    console.warn("RSS failures:");
    for (const f of failures) console.warn(`  - ${f.name}: ${f.error}`);
  }
  if (successes?.length) {
    console.log(`RSS ok: ${successes.length}/${successes.length + failures.length} sources`);
    for (const s of successes.filter((x) => x.items > 0).slice(0, 8)) {
      console.log(`  + ${s.name}: ${s.items} item(s)`);
    }
  }
  console.log(`Candidates: ${items.length}`);
  if (!items.length) {
    throw new Error(
      `No candidates for ${reportDate} (RSS/trending empty). Check network / sources.`,
    );
  }

  const bySection = await summarizeNews(items, reportDate, {
    allowHeuristic: args.allowHeuristic,
  });
  const total = Object.values(bySection).reduce((n, a) => n + a.length, 0);
  console.log(`Editorial items: ${total}`);
  if (!total) {
    throw new Error("No editorial items produced — aborting write");
  }
  for (const [sec, list] of Object.entries(bySection)) {
    if (list.length) console.log(`  ${sec}: ${list.length}`);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const md = renderDailyMarkdown(reportDate, bySection);
  fs.writeFileSync(outFile, md, "utf8");
  console.log(`Wrote ${path.relative(root, outFile)}`);

  if (!args.skipImages && total > 0) {
    await resolveNewsImages({ file: path.relative(root, outFile) });
  }

  if (items.length) saveSeen();

  const sectionCounts = Object.fromEntries(
    Object.entries(bySection).map(([k, v]) => [k, v.length]),
  );
  const report = {
    at: new Date().toISOString(),
    type: "daily",
    date: reportDate,
    candidates: items.length,
    editorial: total,
    sections: sectionCounts,
    rss: {
      ok: successes?.length ?? 0,
      failed: failures?.length ?? 0,
      failures: (failures || []).map((f) => ({ name: f.name, error: f.error })),
    },
    output: path.relative(root, outFile),
  };
  const stateDir = path.join(root, "news/.state");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "last-run.json"),
    JSON.stringify(report, null, 2) + "\n",
    "utf8",
  );
  console.log("Quality report:", JSON.stringify({ editorial: total, sections: sectionCounts }));

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
