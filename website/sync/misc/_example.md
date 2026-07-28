---
title: （示例）来自 Draftly 的同步稿
date: 2026-07-24
summary: 这是 ai-article → 博客同步契约的示例，文件名以下划线开头不会入库。
tags:
  - sync
section: misc
source: ai-article
sourceId: example-source-id-do-not-use
cover: /sync/example-source-id-do-not-use/cover.jpg
draft: true
---

# （示例）来自 Draftly 的同步稿

<p class="article-meta"><time datetime="2026-07-24">2026-07-24</time><span class="article-tag">sync</span></p>

<img class="article-cover" src="/sync/example-source-id-do-not-use/cover.jpg" alt="「（示例）来自 Draftly 的同步稿」封面" />

将本文件复制为 `website/sync/<section>/<slug>.md`（去掉文件名 `_` 前缀，并将 `draft` 设为 `false`）即可被 `npm run ingest` 校验并进入站点。

正文请使用 Markdown。图片放到 `website/public/sync/<sourceId>/` 后用站点相对路径引用，例如：

```md
![cover](/sync/example-source-id-do-not-use/cover.jpg)
```

带说明的章节配图会渲染为 `<figure class="inline-figure"><img .../><figcaption>...</figcaption></figure>`：

<figure class="inline-figure"><img src="/sync/example-source-id-do-not-use/img-1.jpg" alt="配图" /><figcaption>第一章 配图</figcaption></figure>
