#!/usr/bin/env node
/**
 * One-shot: copy docs/ Markdown into website/, rewrite frontmatter, emit redirects map.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = path.join(root, "docs");
const siteRoot = path.join(root, "website");

const SECTION_MAP = [
  { match: /^01\.前端乱炖\//, section: "web", strip: "01.前端乱炖/" },
  { match: /^Vue\//, section: "web", strip: "Vue/", sub: "vue" },
  { match: /^React\//, section: "web", strip: "React/", sub: "react" },
  { match: /^UI组件库\//, section: "web", strip: "UI组件库/", sub: "ui-lib" },
  { match: /^02\.页面杂谈\//, section: "ui", strip: "02.页面杂谈/" },
  { match: /^03\.技术笔记\//, section: "tech", strip: "03.技术笔记/" },
  { match: /^06\.收藏\//, section: "tech", strip: "06.收藏/", sub: "bookmarks" },
  { match: /^04\.更多\//, section: "tech", strip: "04.更多/", sub: "more" },
  { match: /^07\.计算机基础\//, section: "computer", strip: "07.计算机基础/" },
  { match: /^_posts\//, section: "web", strip: "_posts/", sub: "essays" },
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (name.endsWith(".md")) acc.push(full);
  }
  return acc;
}

function parseFrontmatter(raw) {
  if (!raw.startsWith("---")) return { fm: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end < 0) return { fm: {}, body: raw };
  const yaml = raw.slice(4, end).trim();
  const body = raw.slice(end + 4).replace(/^\n/, "");
  const fm = {};
  for (const line of yaml.split("\n")) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    fm[m[1]] = v;
  }
  // categories / tags as simple lists if present in yaml block
  const cats = [];
  const tags = [];
  let mode = null;
  for (const line of yaml.split("\n")) {
    if (/^categories:\s*$/.test(line)) {
      mode = "categories";
      continue;
    }
    if (/^tags:\s*$/.test(line)) {
      mode = "tags";
      continue;
    }
    if (/^\w+:/.test(line)) {
      mode = null;
      continue;
    }
    const item = line.match(/^\s*-\s+(.+)$/);
    if (item && mode === "categories") cats.push(item[1].trim());
    if (item && mode === "tags") tags.push(item[1].trim());
  }
  if (cats.length) fm.categories = cats;
  if (tags.length) fm.tags = tags;
  return { fm, body, yaml };
}

function stripNumPrefix(name) {
  return name.replace(/^\d+\./, "");
}

function slugify(name) {
  return stripNumPrefix(name)
    .replace(/\.md$/, "")
    .replace(/[「」『』【】]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveTarget(rel) {
  if (rel === "05.关于/01.关于.md" || rel.startsWith("05.关于/")) {
    return { section: "about", relPath: "index.md", link: "/about/" };
  }
  if (
    rel.startsWith("00.目录页/") ||
    rel.startsWith("@pages/") ||
    rel === "index.md"
  ) {
    return null;
  }

  for (const rule of SECTION_MAP) {
    if (!rule.match.test(rel)) continue;
    let rest = rel.slice(rule.strip.length);
    const parts = rest.split("/");
    const file = parts.pop();
    const dirs = parts.map(stripNumPrefix).map((p) =>
      p
        .replace(/JavaScript/i, "javascript")
        .replace(/框架扩展/, "framework")
        .replace(/技术文档/, "docs")
        .replace(/GitHub相关/, "github")
        .replace(/Nodejs/i, "nodejs")
        .replace(/浏览器/, "browser")
        .replace(/HTML/i, "html")
        .replace(/CSS/i, "css")
        .replace(/随笔/, "essays"),
    );
    if (rule.sub) dirs.unshift(rule.sub);
    const slug = slugify(file);
    const relPath = [...dirs, `${slug}.md`].filter(Boolean).join("/");
    return {
      section: rule.section,
      relPath,
      link: `/${rule.section}/${relPath.replace(/\.md$/, "")}`,
    };
  }
  return null;
}

function isCatalogue({ fm, yaml }) {
  if (fm.article === "false") return true;
  if (yaml && /pageComponent:/.test(yaml)) return true;
  return false;
}

function writeFrontmatter(fields) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fields)) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${item}`);
    } else if (typeof v === "string" && /[:#]/.test(v)) {
      lines.push(`${k}: "${v.replace(/"/g, '\\"')}"`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

function main() {
  const redirects = [];
  const files = walk(docsRoot);
  let copied = 0;
  let skipped = 0;

  for (const full of files) {
    const rel = path.relative(docsRoot, full).replace(/\\/g, "/");
    const raw = fs.readFileSync(full, "utf8");
    const parsed = parseFrontmatter(raw);
    const target = resolveTarget(rel);

    if (!target) {
      skipped++;
      continue;
    }

    if (isCatalogue(parsed) && target.section !== "about") {
      skipped++;
      continue;
    }

    const title = parsed.fm.title || slugify(path.basename(full));
    const date = (parsed.fm.date || "").slice(0, 10) || "2020-01-01";
    const tags = parsed.fm.tags || [];
    const permalink = parsed.fm.permalink;

    let body = parsed.body.replace(/<!--\s*more\s*-->/gi, "\n");

    const outFields = {
      title,
      date,
      tags,
      section: target.section === "about" ? undefined : target.section,
    };

    if (target.section === "about") {
      outFields.outline = false;
    }

    const outDir =
      target.section === "about"
        ? path.join(siteRoot, "about")
        : path.join(siteRoot, target.section, path.dirname(target.relPath));
    fs.mkdirSync(outDir, { recursive: true });
    const outFile =
      target.section === "about"
        ? path.join(siteRoot, "about", "index.md")
        : path.join(siteRoot, target.section, target.relPath);

    fs.writeFileSync(outFile, writeFrontmatter(outFields) + body, "utf8");
    copied++;

    if (permalink) {
      const from = permalink.replace(/\/$/, "") || permalink;
      redirects.push({
        from: from.startsWith("/") ? from : `/${from}`,
        to: target.link.endsWith("/") ? target.link : `${target.link}`,
      });
    }
  }

  const mapPath = path.join(root, "scripts", "redirects.generated.json");
  fs.writeFileSync(mapPath, JSON.stringify(redirects, null, 2), "utf8");
  console.log(`Migrated ${copied} articles, skipped ${skipped}. Redirects: ${redirects.length}`);
}

main();
