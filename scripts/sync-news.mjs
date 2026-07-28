#!/usr/bin/env node
/**
 * Copy news/ → website/news/, build index + news sidebar fragment.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NEWS_PILLARS } from "./news/sections.mjs";
import { parseDigestMarkdown } from "./news/parse-digest.mjs";
import { writeNewsFeed } from "./build-news-feed.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcNewsRoot = path.join(root, "news");
const websiteRoot = path.join(root, "website");
const newsRoot = path.join(websiteRoot, "news");
const vitepressDir = path.join(websiteRoot, ".vitepress");
const BASE = "/penn-notes/";

const MONTH_DIR_RE = /^\d{4}-\d{2}$/;

function link(p) {
  return BASE + String(p).replace(/^\/+/, "");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function listMonthDirs() {
  if (!fs.existsSync(srcNewsRoot)) return [];
  return fs
    .readdirSync(srcNewsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && MONTH_DIR_RE.test(d.name))
    .map((d) => d.name)
    .sort()
    .reverse();
}

function extractFirstImage(content) {
  const m = content.match(/!\[[^\]]*\]\((https?:\/\/[^)]+|\/[^)]+)\)/);
  return m ? m[1] : "";
}

function parseTitleFromContent(content, fallback) {
  const m = content.match(/^title:\s*(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function copyMonthNews(month) {
  const srcDir = path.join(srcNewsRoot, month);
  const destDir = path.join(newsRoot, month);
  fs.mkdirSync(destDir, { recursive: true });

  const files = fs
    .readdirSync(srcDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse();

  const meta = [];
  for (const file of files) {
    const src = path.join(srcDir, file);
    const dest = path.join(destDir, file);
    const content = fs.readFileSync(src, "utf8");
    fs.writeFileSync(dest, content, "utf8");
    const date =
      (file.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || file.replace(/\.md$/, "");
    const slug = file.replace(/\.md$/, "");
    const isWeekly = file.includes("week");
    meta.push({
      file,
      date,
      slug,
      isWeekly,
      image: extractFirstImage(content),
      title: parseTitleFromContent(
        content,
        isWeekly ? `AI 动态周报 · ${date}` : `AI 动态 · ${date}`,
      ),
    });
  }
  meta.sort((a, b) => {
    if (a.isWeekly !== b.isWeekly) return a.isWeekly ? -1 : 1;
    return a.date < b.date ? 1 : -1;
  });
  return meta;
}

function buildSidebar(months, monthFiles) {
  return {
    "/news/": months.map((month) => ({
      text: month,
      collapsed: false,
      items: monthFiles[month].map((item) => ({
        text: item.isWeekly ? `周报 ${item.date}` : item.date,
        link: `/news/${month}/${item.slug}`,
      })),
    })),
  };
}

function buildNewsIndex(months, monthFiles) {
  const lines = [
    "---",
    "title: AI 动态",
    "outline: false",
    "prev: false",
    "next: false",
    "---",
    "",
    '<div class="section-page">',
    '  <header class="section-hero">',
    '    <p class="section-kicker">栏目</p>',
    '    <h1 class="section-title">AI 动态</h1>',
    '    <p class="section-lead">业界 · 产品 · 模型 · 开源 · 开发者工具 · 前端</p>',
    "  </header>",
    "",
    '  <div class="news-pillars">',
  ];

  for (const p of NEWS_PILLARS) {
    lines.push(
      `    <div class="news-pillar"><p class="news-pillar-title">${escapeHtml(p.title)}</p><p class="news-pillar-desc">${escapeHtml(p.desc)}</p></div>`,
    );
  }
  lines.push("  </div>");
  lines.push("");
  lines.push("  <NewsArchive />");

  let total = 0;
  for (const month of months) {
    total += monthFiles[month].length;
  }

  if (total > 0) {
    lines.push("");
    lines.push('  <div class="section-index news-digest-list">');
    for (const month of months) {
      const files = monthFiles[month];
      if (!files.length) continue;
      lines.push('    <div class="section-group">');
      lines.push(
        `      <p class="section-group-label">${month} · ${files.length} 期日报</p>`,
      );
      lines.push('      <div class="section-card-grid">');
      for (const item of files) {
        const img = item.image
          ? `<img class="section-card-thumb" src="${escapeHtml(item.image)}" alt="" loading="lazy" />`
          : "";
        lines.push(
          `        <a class="section-card${item.image ? " section-card--media" : ""}" href="${link(`/news/${month}/${item.slug}`)}">${img}<span class="section-card-title">${escapeHtml(item.title)}</span><span class="section-card-meta"><time datetime="${item.date}">${item.date}</time><span>阅读全文</span></span></a>`,
        );
      }
      lines.push("      </div>");
      lines.push("    </div>");
    }
    lines.push("  </div>");
  }

  lines.push("</div>");
  lines.push("");
  return lines.join("\n");
}

function collectAllNewsItems(months) {
  const all = [];
  for (const month of months) {
    const dir = path.join(srcNewsRoot, month);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
      if (file === "index.md") continue;
      const slug = file.replace(/\.md$/, "");
      const date = (file.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || "";
      const content = fs.readFileSync(path.join(dir, file), "utf8");
      const items = parseDigestMarkdown(content, {
        date,
        month,
        slug,
        link: `/news/${month}/${slug}`,
      });
      all.push(...items);
    }
  }
  all.sort((a, b) => {
    if (a.itemDate !== b.itemDate) return a.itemDate < b.itemDate ? 1 : -1;
    return 0;
  });
  return all;
}

export function collectRecentNews(limit = 8) {
  const months = listMonthDirs();
  const recent = [];
  for (const month of months) {
    const dir = path.join(srcNewsRoot, month);
    if (!fs.existsSync(dir)) continue;
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();
    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), "utf8");
      const date = (file.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || "";
      const slug = file.replace(/\.md$/, "");
      recent.push({
        date,
        title: `AI 动态 · ${date}`,
        link: `/news/${month}/${slug}`,
        image: extractFirstImage(content),
      });
      if (recent.length >= limit) return recent;
    }
  }
  return recent;
}

function main() {
  fs.mkdirSync(vitepressDir, { recursive: true });

  if (fs.existsSync(newsRoot)) {
    fs.rmSync(newsRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(newsRoot, { recursive: true });

  const months = listMonthDirs();
  const monthFiles = {};
  for (const month of months) {
    monthFiles[month] = copyMonthNews(month);
  }

  const sidebarNews = buildSidebar(months, monthFiles);
  fs.writeFileSync(
    path.join(vitepressDir, "sidebar.news.generated.mjs"),
    `// Auto-generated by scripts/sync-news.mjs — do not edit\nexport default ${JSON.stringify(sidebarNews, null, 2)}\n`,
    "utf8",
  );

  fs.writeFileSync(
    path.join(newsRoot, "index.md"),
    buildNewsIndex(months, monthFiles),
    "utf8",
  );

  // cache recent for build-home
  const recent = collectRecentNews(8);
  fs.writeFileSync(
    path.join(vitepressDir, "news-recent.generated.json"),
    JSON.stringify(recent, null, 2) + "\n",
    "utf8",
  );

  const allItems = collectAllNewsItems(months);
  fs.writeFileSync(
    path.join(vitepressDir, "news-items.generated.json"),
    JSON.stringify(allItems, null, 2) + "\n",
    "utf8",
  );

  writeNewsFeed(allItems);

  const total = months.reduce((n, m) => n + monthFiles[m].length, 0);
  console.log(
    `sync-news: ${total} digest(s), ${allItems.length} item(s) from ${months.length} month folder(s)`,
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) main();
