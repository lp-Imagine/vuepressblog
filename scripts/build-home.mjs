#!/usr/bin/env node
/**
 * Scan website Markdown → regenerate sidebar + homepage + section indexes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = path.join(root, "website");
const BASE = "/vuepressblog/";

const SECTIONS = [
  {
    id: "web",
    title: "JS & 框架",
    nav: "JS & 框架",
    desc: "JavaScript 基础、Vue / React、UI 组件实践",
    link: "/web/",
  },
  {
    id: "ui",
    title: "样式",
    nav: "样式",
    desc: "HTML、CSS、布局与动效",
    link: "/ui/",
  },
  {
    id: "tech",
    title: "工具备忘",
    nav: "工具",
    desc: "Git、npm、常用命令与资源收藏",
    link: "/tech/",
  },
  {
    id: "computer",
    title: "浏览器",
    nav: "浏览器",
    desc: "浏览器渲染与 Chrome 扩展",
    link: "/computer/",
  },
];

/** Sidebar group display order + labels (folder name → 文案) */
const GROUP_META = {
  javascript: { label: "JavaScript", order: 10 },
  vue: { label: "Vue", order: 20 },
  react: { label: "React", order: 30 },
  "ui-lib": { label: "UI 组件", order: 40 },
  html: { label: "HTML", order: 10 },
  css: { label: "CSS", order: 20 },
  docs: { label: "常用文档", order: 10 },
  github: { label: "GitHub", order: 20 },
  nodejs: { label: "Node.js", order: 30 },
  bookmarks: { label: "资源收藏", order: 40 },
  more: { label: "其它", order: 50 },
  browser: { label: "浏览器", order: 10 },
  essays: { label: "随笔", order: 90 },
  framework: { label: "框架", order: 25 },
  misc: { label: "其它", order: 99 },
};

function link(p) {
  return BASE + String(p).replace(/^\/+/, "");
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (name.endsWith(".md") && name !== "index.md") acc.push(full);
  }
  return acc;
}

function parseFm(raw) {
  if (!raw.startsWith("---")) return { title: "", date: "", draft: false, group: "" };
  const end = raw.indexOf("\n---", 3);
  if (end < 0) return { title: "", date: "", draft: false, group: "" };
  const yaml = raw.slice(4, end);
  const get = (key) => {
    const m = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    if (!m) return "";
    return m[1].trim().replace(/^["']|["']$/g, "");
  };
  return {
    title: get("title"),
    date: get("date").slice(0, 10),
    draft: get("draft") === "true",
    sourceId: get("sourceId"),
    group: get("group"),
  };
}

function collectSection(sectionId) {
  const dir = path.join(siteRoot, sectionId);
  const syncDir = path.join(siteRoot, "sync", sectionId);
  const files = [...walk(dir), ...walk(syncDir)];
  const items = [];
  for (const full of files) {
    const raw = fs.readFileSync(full, "utf8");
    const fm = parseFm(raw);
    if (fm.draft) continue;
    const rel = path.relative(siteRoot, full).replace(/\\/g, "/");
    const urlPath = "/" + rel.replace(/\.md$/, "");
    items.push({
      title: fm.title || path.basename(full, ".md"),
      date: fm.date || "1970-01-01",
      link: urlPath,
      rel,
      group: fm.group || "",
    });
  }
  items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return items;
}

const GROUP_LABELS = {
  javascript: "JavaScript",
  "ui-lib": "UI 组件库",
  vue: "Vue",
  react: "React",
  html: "HTML",
  css: "CSS",
  docs: "技术文档",
  github: "GitHub",
  nodejs: "Node.js",
  bookmarks: "收藏夹",
  more: "更多",
  browser: "浏览器",
  essays: "随笔",
  framework: "框架扩展",
  web: "前端",
  ui: "页面",
  tech: "技术",
  computer: "计算机",
  misc: "其它",
};

function labelGroup(key) {
  if (GROUP_LABELS[key]) return GROUP_LABELS[key];
  if (key === "来自 Draftly") return "Draftly 同步";
  return key;
}

function groupSidebar(items, sectionId) {
  const groups = new Map();
  for (const item of items) {
    const parts = item.rel.split("/");
    let groupKey = "misc";
    if (parts[0] === "sync") {
      // sync/<section>/<group>/<file>.md 或 sync/<section>/<file>.md
      if (parts.length >= 4) groupKey = parts[2];
      else if (item.group) groupKey = item.group;
      else groupKey = "misc";
    } else if (parts.length >= 3) {
      groupKey = parts[1];
    } else if (parts.length === 2) {
      groupKey = sectionId;
    }

    const meta = GROUP_META[groupKey] || {
      label: GROUP_LABELS[groupKey] || groupKey,
      order: 80,
    };
    const label = meta.label;
    if (!groups.has(label)) {
      groups.set(label, { order: meta.order, items: [] });
    }
    groups.get(label).items.push({ text: item.title, link: item.link });
  }

  return [...groups.entries()]
    .sort((a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0], "zh"))
    .map(([text, group]) => ({
      text,
      collapsed: true,
      items: group.items,
    }));
}

function writeSectionIndex(section, items) {
  const groups = groupSidebar(items, section.id);
  const n = items.length;

  const groupBlocks =
    groups.length === 0
      ? `<p class="home-empty">暂无文章</p>`
      : groups
          .map((g) => {
            const cards = g.items
              .map((item) => {
                const date =
                  items.find((x) => x.link === item.link)?.date || "";
                return `    <a class="section-card" href="${link(item.link)}">
      <span class="section-card-title">${escapeHtml(item.text)}</span>
      <span class="section-card-meta"><time datetime="${date}">${date}</time><span>阅读全文</span></span>
    </a>`;
              })
              .join("\n");
            return `  <div class="section-group">
    <p class="section-group-label">${escapeHtml(g.text)} · ${g.items.length} 篇</p>
    <div class="section-card-grid">
${cards}
    </div>
  </div>`;
          })
          .join("\n");

  const content = `---
title: ${section.title}
outline: false
sidebar: false
aside: false
---

<div class="section-page">
  <header class="section-hero">
    <p class="section-kicker">栏目</p>
    <h1 class="section-title">${section.title}</h1>
    <p class="section-lead">${section.desc}</p>
    <p class="section-count">共 ${n} 篇笔记</p>
  </header>

  <div class="section-index">
${groupBlocks}
  </div>
</div>
`;

  fs.mkdirSync(path.join(siteRoot, section.id), { recursive: true });
  fs.writeFileSync(path.join(siteRoot, section.id, "index.md"), content, "utf8");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHome(allBySection) {
  const recent = Object.values(allBySection)
    .flat()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8);

  const total = Object.values(allBySection).reduce((n, a) => n + a.length, 0);

  const pillars = SECTIONS.map((s) => {
    const n = allBySection[s.id]?.length || 0;
    return `  <a class="home-pillar" href="${link(s.link)}">
    <p class="home-pillar-title">${s.title}</p>
    <p class="home-pillar-desc">${s.desc}</p>
    <p class="home-pillar-meta">${n} 篇笔记</p>
  </a>`;
  }).join("\n");

  const newsItems =
    recent.length === 0
      ? `<p class="home-empty">暂无文章</p>`
      : `<div class="news-grid">
${recent
  .map(
    (r) => `  <a class="news-card" href="${link(r.link)}">
    <time datetime="${r.date}">${r.date}</time>
    <span class="news-card-title">${escapeHtml(r.title)}</span>
    <span class="news-card-action">阅读全文</span>
  </a>`,
  )
  .join("\n")}
</div>`;

  const catalog = SECTIONS.map((s) => {
    const items = allBySection[s.id] || [];
    const n = items.length;
    const groups = groupSidebar(items, s.id)
      .slice(0, 4)
      .map((g) => g.text)
      .join("、");
    return `  <div class="course-mod">
    <p class="course-mod-label">${s.title} · ${n} 篇</p>
    <a class="course-card" href="${link(s.link)}">
      <span class="course-card-title">${s.title}</span>
      <span class="course-card-desc">${n} 篇 · ${groups || s.desc}</span>
    </a>
  </div>`;
  }).join("\n");

  const latestHref = recent[0] ? link(recent[0].link) : link("/web/");

  return `---
layout: home
---

<div class="home-wrap">
  <section class="home-hero">
    <h1 class="home-headline">Penn Notes</h1>
    <p class="home-tagline">JS &amp; 框架 · 样式 · 工具 · 浏览器</p>
    <p class="home-sub">积跬步以至千里 · 前端学习与工程备忘 · 共 ${total} 篇</p>
    <div class="home-actions">
      <a class="home-btn home-btn--primary" href="${latestHref}">阅读最新笔记</a>
      <a class="home-btn home-btn--text" href="${link("/web/")}">浏览分类</a>
    </div>
  </section>

  <section class="home-pillars">
${pillars}
  </section>

  <section class="home-block">
    <div class="home-block-head">
      <h2>最新笔记</h2>
      <a class="home-more" href="${link("/web/")}">查看更多</a>
    </div>
${newsItems}
  </section>

  <section class="home-block">
    <div class="home-block-head">
      <h2>分类目录</h2>
    </div>
    <p class="home-block-desc">按主题浏览笔记 · 从基础到实践</p>
${catalog}
  </section>
</div>
`;
}

function main() {
  const allBySection = {};
  const sidebar = {};

  for (const section of SECTIONS) {
    const items = collectSection(section.id);
    allBySection[section.id] = items;
    writeSectionIndex(section, items);
    sidebar[`/${section.id}/`] = groupSidebar(items, section.id);
  }

  // also include sync/misc
  const misc = collectSection("misc");
  if (misc.length) {
    allBySection.web = [...(allBySection.web || []), ...misc].sort((a, b) =>
      a.date < b.date ? 1 : -1,
    );
  }

  fs.writeFileSync(
    path.join(siteRoot, ".vitepress", "sidebar.generated.mjs"),
    `// Auto-generated by scripts/build-home.mjs — do not edit\nexport default ${JSON.stringify(sidebar, null, 2)}\n`,
    "utf8",
  );

  fs.writeFileSync(
    path.join(siteRoot, "index.md"),
    buildHome(allBySection),
    "utf8",
  );

  const total = Object.values(allBySection).reduce((n, a) => n + a.length, 0);
  console.log(`build-home: ${total} articles, sidebar keys: ${Object.keys(sidebar).join(", ")}`);
}

main();
