# ai-article → 博客同步契约

本站是静态 VitePress 站。`ai-article` 通过 **GitHub Contents API 写入 Markdown**，再触发构建发布到 GitHub Pages。

## 写入路径

| 类型 | 路径 |
|------|------|
| 正文 | `website/sync/<section>/<slug>.md` |
| 图片 | `website/public/sync/<sourceId>/...` |

`section` 枚举：`web` | `ui` | `tech` | `computer` | `misc`

建议 `slug` 使用 `sourceId` 或 `sourceId-短标题`，保证同一篇文章 upsert 覆盖同一文件。

## Frontmatter

```yaml
---
title: 文章标题
date: 2026-07-24
summary: 一句话摘要
tags:
  - JavaScript
section: web
source: ai-article
sourceId: clxxxxxxxx          # Article.id，幂等主键
cover: /sync/clxxxxxxxx/cover.jpg
draft: false
---

正文使用 **Markdown**。
```

必填：`title`、`date`、`section`、`source`（必须为 `ai-article`）、`sourceId`。

## 触发重建

写入文件后调用 GitHub API：

```http
POST /repos/lp-Imagine/vuepressblog/dispatches
Accept: application/vnd.github+json
Authorization: Bearer <GITHUB_TOKEN>

{
  "event_type": "blog-sync",
  "client_payload": {
    "sourceId": "clxxxxxxxx",
    "path": "website/sync/web/clxxxxxxxx.md"
  }
}
```

Token 需要：`contents: write`、`actions: write`（或足够触发 workflow 的权限）。

## 本地校验

```bash
npm run ingest
```

不符合契约的 sync 稿会导致 `ingest` / CI 失败。

## 示例

见 [`website/sync/misc/_example.md`](../website/sync/misc/_example.md)（以下划线开头，不会被 ingest 当作正式稿扫描；可复制后去掉 `_` 前缀测试）。
