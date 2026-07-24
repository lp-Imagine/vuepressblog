---
title: flex布局案例-圣杯布局
date: 2019-12-25
tags:
  - CSS
section: ui
---

# flex布局案例-圣杯布局

<p class="article-meta"><time datetime="2019-12-25">2019-12-25</time><span class="article-tag">CSS</span></p>

> 可用<kbd>F12</kbd>开发者工具查看元素及样式，可打开codepen在线编辑代码。




::: demo [vanilla]
```html
&lt;html&gt;
  <div class="HolyGrail">
    <header>#header</header>
    <div class="wrap">
      <nav class="left">left 宽度固定200px</nav>
      <main class="content">center 宽度自适应</main>
      <aside class="right">right 宽度固定200px</aside>
    </div>
    <footer>#footer</footer>
  </div>
&lt;/html&gt;
<style>
  .HolyGrail {
    text-align: center;
    display: flex;
    min-height: 40vh;
    flex-direction: column;
  }
  .HolyGrail .wrap {
    display: flex;
    flex: 1;
  }
  .HolyGrail .content {
    background: #eee;
    flex: 1;
  }
  .HolyGrail .left,.HolyGrail .right {
    background:lightgreen;
    flex: 0 0 200px;
  }
  .HolyGrail header,.HolyGrail footer{
    background:#999;
    height: 50px;
    line-height: 50px;
  }
  .HolyGrail .left {
    background:salmon;
  }
</style>
```
:::

> 参考：&lt;http://www.ruanyifeng.com/blog/2015/07/flex-examples.html&gt;
