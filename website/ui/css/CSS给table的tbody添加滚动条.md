---
title: CSS给table的tbody添加滚动条
date: 2022-06-29
tags:
  - CSS
section: ui
---

# CSS给table的tbody添加滚动条

<p class="article-meta"><time datetime="2022-06-29">2022-06-29</time><span class="article-tag">CSS</span></p>

```css
table tbody {
  height: 200px;
  overflow-y: auto;
  display: block;
}

table thead,
tbody tr {
  display: table;
  width: 100%;
}
```

