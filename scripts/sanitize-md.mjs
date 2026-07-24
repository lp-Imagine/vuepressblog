#!/usr/bin/env node
/** Escape Markdown fragments that Vue/VitePress treat as illegal HTML tags. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = path.join(root, "website");

const OK = new Set([
  "a", "abbr", "b", "blockquote", "br", "code", "div", "em", "h1", "h2", "h3",
  "h4", "h5", "h6", "hr", "i", "img", "li", "ol", "p", "pre", "span", "strong",
  "table", "tbody", "td", "th", "thead", "tr", "ul", "sup", "sub", "kbd",
  "details", "summary", "section", "figure", "figcaption", "video", "audio",
  "source", "iframe", "svg", "path", "g", "use", "nav", "header", "footer",
  "main", "aside", "button", "label", "form", "input", "textarea", "select",
  "option", "template", "style", "script",
]);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === ".vitepress" || name === "public") continue;
      walk(full, acc);
    } else if (name.endsWith(".md")) acc.push(full);
  }
  return acc;
}

function escapeBadTags(src) {
  let out = src.replace(/<(https?:\/\/[^>\s]+)>/g, "&lt;$1&gt;");
  out = out.replace(/<\/?([A-Za-z][\w:.-]*)([^>]*)>/g, (m, name) => {
    const n = name.toLowerCase();
    if (OK.has(n) || n.startsWith("vp-") || n.includes("-")) return m;
    return m.replace(/^</, "&lt;").replace(/>$/, "&gt;");
  });
  out = out.replace(/(^|[^`\\])<(\d)/gm, "$1&lt;$2");
  out = out.replace(/(^|[^`\\])<=/gm, "$1&lt;=");
  return out;
}

function main() {
  let n = 0;
  for (const f of walk(siteRoot)) {
    const before = fs.readFileSync(f, "utf8");
    const after = escapeBadTags(before);
    if (after !== before) {
      fs.writeFileSync(f, after);
      n++;
    }
  }
  console.log(`sanitize-md: updated ${n} file(s)`);
}

main();
