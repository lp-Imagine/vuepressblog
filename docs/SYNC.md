# ai-article → 博客同步契约

本站是静态 VitePress 站。`ai-article` 通过 **GitHub Contents API 写入 Markdown**，再触发构建发布到 GitHub Pages。

## 写入路径

| 类型 | 路径 |
|------|------|
| 正文 | `website/<section>/<group>/<slug>.md`（与手写笔记同目录，才能挂上对应侧栏） |
| 图片 | `website/public/sync/<sourceId>/...` |

`section` 枚举：`web` | `ui` | `tech` | `computer` | `agent` | `misc`

`group` 与侧栏分组对齐，例如：

- `web`：`javascript` / `vue` / `react` / `ui-lib` / `misc`
- `ui`：`html` / `css` / `misc`
- `tech`：`docs` / `github` / `nodejs` / `bookmarks` / `misc`
- `computer`：`browser` / `misc`
- `agent`：`practice` / `workflow` / `prompts` / `tools` / `misc`（AI Agent 栏目）
- `misc`：`essays` / `career` / `life` / `method` / `misc`（杂项栏目）

建议 `slug` 使用 `sourceId`，保证同一篇文章 upsert 覆盖同一文件。

> 兼容：历史稿若仍在 `website/sync/<section>/...`，构建时也会并入对应栏目侧栏。

## Frontmatter

```yaml
---
title: 文章标题
date: 2026-07-24
summary: 一句话摘要
tags:
  - JavaScript
section: web
group: javascript
source: ai-article
sourceId: clxxxxxxxx          # Article.id，幂等主键
cover: /sync/clxxxxxxxx/cover.jpg
draft: false
---

# 文章标题

<p class="article-meta">...</p>

<img class="article-cover" src="/sync/clxxxxxxxx/cover.jpg" alt="「文章标题」封面" />

正文使用 **Markdown**（代码块用 fenced ```）。
```

必填：`title`、`date`、`section`、`source`（必须为 `ai-article`）、`sourceId`。  
推荐：`group`（决定子目录与侧栏分类）。

> 封面图：除了在 frontmatter 写 `cover`（元数据），还会在正文 meta 之后插入 `<img class="article-cover">`，由 `custom.css` 渲染为全宽圆角封面。章节配图保留 `<figcaption>`，渲染为 `.inline-figure`。

## 触发重建

写入文件后调用 GitHub API：

```http
POST /repos/lp-Imagine/penn-notes/dispatches
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
