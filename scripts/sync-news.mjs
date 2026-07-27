#!/usr/bin/env node
/**
 * Copy news/ → website/news/, build index + news sidebar fragment.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NEWS_PILLARS } from "./news/sections.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcNewsRoot = path.join(root, "news");
const websiteRoot = path.join(root, "website");
const newsRoot = path.join(websiteRoot, "news");
const vitepressDir = path.join(websiteRoot, ".vitepress");
const BASE = "/vuepressblog/";

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
    const date = (file.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || file.replace(/\.md$/, "");
    meta.push({
      file,
      date,
      slug: file.replace(/\.md$/, ""),
      image: extractFirstImage(content),
      title: `AI 动态 · ${date}`,
    });
  }
  return meta;
}

function buildSidebar(months, monthFiles) {
  return {
    "/news/": months.map((month) => ({
      text: month,
      collapsed: false,
      items: monthFiles[month].map((item) => ({
        text: item.date,
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
  lines.push('  <div class="section-index">');

  let total = 0;
  for (const month of months) {
    const files = monthFiles[month];
    if (!files.length) continue;
    lines.push('    <div class="section-group">');
    lines.push(
      `      <p class="section-group-label">${month} · ${files.length} 篇</p>`,
    );
    lines.push('      <div class="section-card-grid">');
    for (const item of files) {
      total++;
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

  if (total === 0) {
    lines.push('    <p class="home-empty">暂无日报。配置 LLM_API_KEY 后运行 <code>npm run news:daily</code>。</p>');
  }

  lines.push("  </div>");
  lines.push("</div>");
  lines.push("");
  return lines.join("\n");
}

/** Collect recent digests for homepage (exported for build-home). */
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

  const total = months.reduce((n, m) => n + monthFiles[m].length, 0);
  console.log(`sync-news: ${total} digest(s) from ${months.length} month folder(s)`);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) main();
