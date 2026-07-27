/**
 * Resolve og:image for news markdown items.
 * Prefer HTTPS hotlinks; fall back to downloading into website/public/news/.
 *
 * Usage:
 *   node scripts/resolve-news-images.mjs
 *   node scripts/resolve-news-images.mjs --file=news/2026-07/ai-news-2026-07-26.md
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetch as undiciFetch, Headers, Request, Response } from "undici";

if (typeof globalThis.fetch !== "function") {
  globalThis.fetch = undiciFetch;
  globalThis.Headers = Headers;
  globalThis.Request = Request;
  globalThis.Response = Response;
}

const fetch = globalThis.fetch.bind(globalThis);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const newsRoot = path.join(root, "news");
const publicNews = path.join(root, "website/public/news");
const BASE = "/vuepressblog/";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const STRIP_IMAGE =
  /the_verge_social_share|global-social-marketing|github-logo-|apple-touch-icon|google-og-image|arxiv-logo-fb|chatgpt\/share-og|favicon\.ico|hellogithub\.com\/images\/logo|cropped-favicon-gradient|reuters-logo\.png|default_article_june|verge-placeholder|wp-content\/uploads\/.*logo/i;

function listNewsFiles(onlyFile) {
  if (onlyFile) {
    const full = path.isAbsolute(onlyFile) ? onlyFile : path.join(root, onlyFile);
    return fs.existsSync(full) ? [full] : [];
  }
  if (!fs.existsSync(newsRoot)) return [];
  const out = [];
  for (const month of fs.readdirSync(newsRoot)) {
    if (month.startsWith(".")) continue;
    const dir = path.join(newsRoot, month);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".md")) out.push(path.join(dir, f));
    }
  }
  return out.sort();
}

function extractOgImage(html) {
  const patterns = [
    /property=["']og:image(?::secure_url)?["']\s+content=["']([^"']+)["']/i,
    /content=["']([^"']+)["']\s+property=["']og:image(?::secure_url)?["']/i,
    /name=["']twitter:image(?::src)?["']\s+content=["']([^"']+)["']/i,
    /"og:image"\s*:\s*"([^"]+)"/i,
    /"twitter:image"\s*:\s*"([^"]+)"/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].replace(/\\u002F/g, "/").replace(/&amp;/g, "&");
  }
  return null;
}

function githubRepoFromUrl(url) {
  const m = String(url).match(/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/);
  if (!m) return null;
  const repo = m[1].replace(/\/+$/, "").split("/").slice(0, 2).join("/");
  if (["trending", "periodical", "repository", "topics", "sponsors"].includes(repo.split("/")[1])) {
    return null;
  }
  return repo;
}

async function headOk(url, cache) {
  if (!url?.startsWith("http")) return false;
  const key = `ok:${url}`;
  if (cache.has(key)) return cache.get(key);
  const opts = {
    headers: { "User-Agent": UA },
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  };
  try {
    let res = await fetch(url, { ...opts, method: "HEAD" });
    let ct = res.headers.get("content-type") || "";
    if (res.ok && ct.startsWith("image/")) {
      cache.set(key, true);
      return true;
    }
    res = await fetch(url, {
      ...opts,
      method: "GET",
      headers: { ...opts.headers, Range: "bytes=0-0" },
    });
    ct = res.headers.get("content-type") || "";
    const ok = res.ok && ct.startsWith("image/");
    cache.set(key, ok);
    return ok;
  } catch {
    cache.set(key, false);
    return false;
  }
}

async function downloadImage(url, month, cache) {
  const key = `dl:${url}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) {
      cache.set(key, null);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200 || buf.length > 2_500_000) {
      cache.set(key, null);
      return null;
    }
    let ext = "jpg";
    if (ct.includes("png")) ext = "png";
    else if (ct.includes("webp")) ext = "webp";
    else if (ct.includes("gif")) ext = "gif";
    const hash = crypto.createHash("sha1").update(url).digest("hex").slice(0, 12);
    const dir = path.join(publicNews, month);
    fs.mkdirSync(dir, { recursive: true });
    const file = `${hash}.${ext}`;
    fs.writeFileSync(path.join(dir, file), buf);
    const local = `${BASE}news/${month}/${file}`;
    cache.set(key, local);
    return local;
  } catch {
    cache.set(key, null);
    return null;
  }
}

async function resolveImage(sourceUrl, title, month, cache) {
  if (!sourceUrl) return null;

  const repo = githubRepoFromUrl(sourceUrl);
  if (repo) {
    const gh = `https://opengraph.githubassets.com/1/${repo}`;
    if (await headOk(gh, cache)) return gh;
  }

  const cacheKey = `src:${sourceUrl}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  let image = null;
  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const html = await res.text();
      image = extractOgImage(html);
      if (image && !image.startsWith("http")) {
        image = new URL(image, sourceUrl).href;
      }
    }
  } catch {
    /* network */
  }

  if (image && !STRIP_IMAGE.test(image)) {
    if (await headOk(image, cache)) {
      cache.set(cacheKey, image);
      return image;
    }
    // hotlink failed → try download
    const local = await downloadImage(image, month, cache);
    if (local) {
      cache.set(cacheKey, local);
      return local;
    }
  }

  cache.set(cacheKey, null);
  return null;
}

function firstSourceUrl(sourceLine) {
  const md = sourceLine.match(/\]\((https?:\/\/[^)]+)\)/);
  if (md) return md[1];
  const html = sourceLine.match(/href=["'](https?:\/\/[^"']+)["']/i);
  return html ? html[1] : null;
}

/**
 * Process one markdown file: insert ![配图](...) after ### title when missing.
 */
export async function resolveFileImages(filePath, cache = new Map()) {
  const rel = path.relative(root, filePath);
  const monthMatch = rel.match(/news\/(\d{4}-\d{2})\//);
  const month = monthMatch ? monthMatch[1] : "misc";
  let content = fs.readFileSync(filePath, "utf8");

  // Split by ### headings (items)
  const parts = content.split(/\n(?=### )/);
  if (parts.length < 2) return { file: rel, updated: 0 };

  let updated = 0;
  const out = [parts[0]];

  // concurrency pool
  const queue = [];
  for (let i = 1; i < parts.length; i++) {
    queue.push(i);
  }

  const results = new Map();
  const concurrency = 5;
  let idx = 0;

  async function worker() {
    while (idx < queue.length) {
      const i = queue[idx++];
      const block = parts[i];
      const titleLine = block.match(/^### ([^\n]+)/);
      const title = titleLine ? titleLine[1].trim() : "";
      const hasImage =
        /^### [^\n]+\n\n(?:<p class="news-entry-meta">[\s\S]*?<\/p>\n\n)?!\[[^\]]*\]\(/m.test(
          block,
        ) || /^### [^\n]+\n\n!\[[^\]]*\]\(/m.test(block);
      if (hasImage) {
        results.set(i, block);
        continue;
      }
      const sourceLine =
        block.match(/<p class="news-entry-source">[\s\S]*?<\/p>/m)?.[0] ||
        block.match(/^\*\*来源：\*\*.+$/m)?.[0] ||
        block.match(/^- \*\*来源：\*\*.+$/m)?.[0] ||
        "";
      const url = firstSourceUrl(sourceLine);
      const image = await resolveImage(url, title, month, cache);
      if (!image) {
        results.set(i, block);
        continue;
      }
      updated++;
      // Insert image after title (+ optional date / meta line)
      let patched;
      if (
        /^### [^\n]+\n\n<p class="news-entry-meta">[\s\S]*?<\/p>\n\n/.test(block)
      ) {
        patched = block.replace(
          /^(### [^\n]+\n\n<p class="news-entry-meta">[\s\S]*?<\/p>\n\n)/,
          `$1![配图](${image})\n\n`,
        );
      } else if (/^### [^\n]+\n\n\d{4}-\d{2}-\d{2}\n\n/.test(block)) {
        patched = block.replace(
          /^(### [^\n]+\n\n\d{4}-\d{2}-\d{2}\n\n)/,
          `$1![配图](${image})\n\n`,
        );
      } else {
        patched = block.replace(
          /^(### [^\n]+)\n\n/,
          `$1\n\n![配图](${image})\n\n`,
        );
      }
      results.set(i, patched);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  for (let i = 1; i < parts.length; i++) {
    out.push(results.get(i) || parts[i]);
  }

  const next = out.join("\n");
  if (next !== content) {
    fs.writeFileSync(filePath, next, "utf8");
  }
  return { file: rel, updated };
}

export async function resolveNewsImages(opts = {}) {
  const files = listNewsFiles(opts.file);
  const cache = new Map();
  let total = 0;
  for (const f of files) {
    const r = await resolveFileImages(f, cache);
    total += r.updated;
    if (r.updated) console.log(`images: ${r.file} +${r.updated}`);
  }
  console.log(`resolve-news-images: updated ${total} item(s) across ${files.length} file(s)`);
  return total;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const fileArg = process.argv.find((a) => a.startsWith("--file="));
  await resolveNewsImages({ file: fileArg ? fileArg.slice(7) : undefined });
}
