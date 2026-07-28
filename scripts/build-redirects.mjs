#!/usr/bin/env node
/**
 * Emit static HTML redirect pages for old VuePress permalinks (GitHub Pages).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mapPath = path.join(root, "scripts", "redirects.generated.json");
const dist = path.join(root, "website", ".vitepress", "dist");
const BASE = "/penn-notes";

function main() {
  if (!fs.existsSync(mapPath)) {
    console.log("build-redirects: no redirects map, skip");
    return;
  }
  if (!fs.existsSync(dist)) {
    console.warn("build-redirects: dist missing, skip");
    return;
  }

  const redirects = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  let n = 0;
  for (const { from, to } of redirects) {
    const fromPath = from.replace(/\/$/, "");
    const target = `${BASE}${to.startsWith("/") ? to : `/${to}`}`.replace(
      /\/+/g,
      "/",
    );
    // ensure trailing semantics for cleanUrls
    const href = target.endsWith("/") ? target : target;
    const dir = path.join(dist, fromPath.replace(/^\//, ""));
    fs.mkdirSync(dir, { recursive: true });
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0;url=${href}" />
  <link rel="canonical" href="${href}" />
  <title>Redirecting…</title>
  <script>location.replace(${JSON.stringify(href)})</script>
</head>
<body>
  <p>Redirecting to <a href="${href}">${href}</a>…</p>
</body>
</html>
`;
    fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
    n++;
  }
  console.log(`build-redirects: wrote ${n} redirect page(s)`);
}

main();
