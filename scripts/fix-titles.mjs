#!/usr/bin/env node
/**
 * Ensure each article has a visible Markdown H1 from frontmatter.title.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = path.join(root, "website");

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === ".vitepress" || name === "public") continue;
      walk(full, acc);
    } else if (name.endsWith(".md") && name !== "index.md") {
      acc.push(full);
    }
  }
  return acc;
}

function parse(raw) {
  if (!raw.startsWith("---")) return null;
  const end = raw.indexOf("\n---", 3);
  if (end < 0) return null;
  const yaml = raw.slice(4, end);
  const body = raw.slice(end + 4).replace(/^\n+/, "");
  const titleMatch = yaml.match(/^title:\s*(.+)$/m);
  let title = titleMatch ? titleMatch[1].trim() : "";
  if (
    (title.startsWith('"') && title.endsWith('"')) ||
    (title.startsWith("'") && title.endsWith("'"))
  ) {
    title = title.slice(1, -1);
  }
  const dateMatch = yaml.match(/^date:\s*(.+)$/m);
  const date = dateMatch ? dateMatch[1].trim().slice(0, 10) : "";
  const tags = [];
  let inTags = false;
  for (const line of yaml.split("\n")) {
    if (/^tags:\s*$/.test(line)) {
      inTags = true;
      continue;
    }
    if (/^\w+:/.test(line)) {
      inTags = false;
      continue;
    }
    const m = line.match(/^\s*-\s+(.+)$/);
    if (inTags && m && m[1] !== "null") tags.push(m[1].trim());
  }
  return { yaml, body, title, date, tags, raw };
}

function hasH1(body) {
  return /(^|\n)# [^#\n]/.test(body);
}

function buildMeta({ date, tags }) {
  const parts = [];
  if (date) parts.push(`<time datetime="${date}">${date}</time>`);
  for (const tag of tags) {
    parts.push(`<span class="article-tag">${tag}</span>`);
  }
  if (!parts.length) return "";
  return `<p class="article-meta">${parts.join("")}</p>\n\n`;
}

function main() {
  let fixed = 0;
  for (const file of walk(siteRoot)) {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = parse(raw);
    if (!parsed?.title) continue;

    let body = parsed.body;
    let changed = false;

    if (!hasH1(body)) {
      body = `# ${parsed.title}\n\n${buildMeta(parsed)}${body}`;
      changed = true;
    } else if (!body.includes('class="article-meta"') && (parsed.date || parsed.tags.length)) {
      // Insert meta right after first H1 line
      body = body.replace(/^(# .+)\n+/, `$1\n\n${buildMeta(parsed)}`);
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(file, `---\n${parsed.yaml}\n---\n\n${body}`, "utf8");
      fixed++;
    }
  }
  console.log(`fix-titles: updated ${fixed} file(s)`);
}

main();
