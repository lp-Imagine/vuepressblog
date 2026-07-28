import mediumZoom, { type Zoom } from "medium-zoom";
import { nextTick, onMounted, watch, defineComponent, h } from "vue";
import { useRoute } from "vitepress";
import DefaultTheme from "vitepress/theme";
import AboutFriends from "./AboutFriends.vue";
import NewsArchive from "./NewsArchive.vue";
import NewsDigestEnhance from "./NewsDigestEnhance.vue";
import NewsRssSubscribe from "./NewsRssSubscribe.vue";
import "./custom.css";

let zoom: Zoom | undefined;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let observer: MutationObserver | undefined;

function collectImages(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLImageElement>(".vp-doc img"),
  ).filter((img) => {
    if (img.classList.contains("no-zoom")) return false;
    if (img.classList.contains("about-friend-avatar")) return false;
    if (img.classList.contains("VPImage")) return false;
    if (img.classList.contains("section-card-thumb")) return false;
    if (img.closest("a")) return false;
    return Boolean(img.getAttribute("src"));
  });
}

function refreshZoom() {
  zoom?.detach();
  zoom = undefined;
  const images = collectImages();
  if (!images.length) return;
  zoom = mediumZoom(images, {
    background: "rgba(0, 0, 0, 0.84)",
    margin: 16,
  });
}

function scheduleRefresh() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    nextTick(() => refreshZoom());
  }, 80);
}

const Layout = defineComponent({
  name: "PennLayout",
  setup(_props, { slots }) {
    const route = useRoute();
    return () => {
      const isHome =
        route.path === "/" || route.path.endsWith("/index.html");
      const layoutClass = ["site-layout", isHome ? "home-layout" : ""]
        .filter(Boolean)
        .join(" ");
      return h(
        DefaultTheme.Layout,
        { class: layoutClass },
        {
          ...slots,
          "doc-top": () => [slots["doc-top"]?.(), h(NewsDigestEnhance)],
        },
      );
    };
  },
});

export default {
  extends: DefaultTheme,
  Layout,
  // VitePress theme-level setup (runs on client; official medium-zoom pattern)
  setup() {
    const route = useRoute();
    onMounted(() => {
      scheduleRefresh();
      const content = document.querySelector(".VPContent") || document.getElementById("app");
      if (content && !observer) {
        observer = new MutationObserver(() => scheduleRefresh());
        observer.observe(content, { childList: true, subtree: true });
      }
    });
    watch(
      () => route.path,
      () => scheduleRefresh(),
    );
  },
  enhanceApp({ app }) {
    app.component("AboutFriends", AboutFriends);
    app.component("NewsArchive", NewsArchive);
    app.component("NewsRssSubscribe", NewsRssSubscribe);
  },
};
