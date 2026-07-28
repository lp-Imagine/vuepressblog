import { defineConfig } from "vitepress";
import sidebar from "./sidebar.generated.mjs";
import newsSidebar from "./sidebar.news.generated.mjs";

const BASE = "/penn-notes/";
const GITHUB_PROFILE = "https://github.com/lp-Imagine";

// Absolute URLs: Chrome on GitHub project Pages often ignores late/subpath icon links
// and falls back to https://lp-imagine.github.io/favicon.ico
const ICON_PNG = "https://lp-imagine.github.io/penn-notes/pn-favicon-32.png";
const ICON_ICO = "https://lp-imagine.github.io/penn-notes/favicon.ico";
const ICON_APPLE =
  "https://lp-imagine.github.io/penn-notes/img/pn-apple-touch.png";

const faviconHeadSnippet = [
  `<link rel="icon" href="${ICON_ICO}" sizes="any">`,
  `<link rel="icon" type="image/png" sizes="32x32" href="${ICON_PNG}">`,
  `<link rel="apple-touch-icon" sizes="180x180" href="${ICON_APPLE}">`,
].join("");

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
  // Inject icons at the very start of <head> (VitePress otherwise places module scripts first)
  vite: {
    plugins: [
      {
        name: "penn-early-favicon",
        transformIndexHtml(html) {
          if (html.includes('data-penn-favicon="1"')) return html;
          const snippet = faviconHeadSnippet.replace(
            "<link ",
            '<link data-penn-favicon="1" ',
          );
          return html.replace(/<head>/i, `<head>${snippet}`);
        },
      },
    ],
  },
  head: [
    ["link", { rel: "icon", href: ICON_ICO, sizes: "any" }],
    [
      "link",
      { rel: "icon", type: "image/png", sizes: "32x32", href: ICON_PNG },
    ],
    [
      "link",
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: ICON_APPLE,
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
