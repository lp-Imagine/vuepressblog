import { defineConfig } from "vitepress";
import sidebar from "./sidebar.generated.mjs";
import newsSidebar from "./sidebar.news.generated.mjs";

const BASE = "/penn-notes/";
const GITHUB_PROFILE = "https://github.com/lp-Imagine";

const mergedSidebar = {
  ...sidebar,
  ...newsSidebar,
};

export default defineConfig({
  title: "Penn Notes",
  description:
    "Penn 的前端笔记：JavaScript、Vue、React、CSS、Git 等学习与总结。",
  lang: "zh-CN",
  base: BASE,
  cleanUrls: true,
  lastUpdated: true,
  appearance: "dark",
  ignoreDeadLinks: true,
  head: [
    // New filenames (not ?v=): Chrome often ignores query-string favicon cache busting
    [
      "link",
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: `${BASE}pn-favicon-32.png`,
      },
    ],
    [
      "link",
      {
        rel: "shortcut icon",
        type: "image/x-icon",
        href: `${BASE}pn-favicon.ico`,
      },
    ],
    [
      "link",
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: `${BASE}img/pn-apple-touch.png`,
      },
    ],
    ["meta", { name: "theme-color", content: "#000000" }],
    [
      "link",
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: "Penn Notes · AI 动态",
        href: `${BASE}news/feed.xml`,
      },
    ],
    [
      "script",
      {},
      `(function(){try{var k='vitepress-theme-appearance',v=localStorage.getItem(k);if(!v||v==='auto')localStorage.setItem(k,'dark')}catch(e){}})()`,
    ],
  ],
  themeConfig: {
    siteTitle: "Penn Notes",
    logo: {
      light: "/img/logo.svg",
      dark: "/img/logo.svg",
      alt: "Penn Notes",
    },
    notFound: {
      title: "页面不存在",
      quote: "该页面不存在或链接已失效。",
      linkLabel: "返回首页",
      linkText: "返回首页",
    },
    nav: [
      { text: "首页", link: "/" },
      { text: "AI 动态", link: "/news/", activeMatch: "/news/" },
      { text: "JS & 框架", link: "/web/", activeMatch: "/web/" },
      { text: "样式", link: "/ui/", activeMatch: "/ui/" },
      { text: "工具", link: "/tech/", activeMatch: "/tech/" },
      { text: "浏览器", link: "/computer/", activeMatch: "/computer/" },
      { text: "关于", link: "/about/", activeMatch: "/about/" },
    ],
    sidebar: mergedSidebar,
    socialLinks: [{ icon: "github", link: GITHUB_PROFILE }],
    search: { provider: "local" },
    outline: { level: [2, 3], label: "章节索引" },
    sidebarMenuLabel: "目录",
    lastUpdated: { text: "上次更新" },
    docFooter: { prev: "上一篇", next: "下一篇" },
    returnToTopLabel: "返回顶部",
    footer: {
      message: "由 Penn 制作 · 前端学习笔记",
      copyright: "Copyright © 2020-present Penn",
    },
  },
});
