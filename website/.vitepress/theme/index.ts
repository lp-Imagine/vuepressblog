import { defineComponent, h } from "vue";
import { useRoute } from "vitepress";
import DefaultTheme from "vitepress/theme";
import NewsArchive from "./NewsArchive.vue";
import NewsDigestEnhance from "./NewsDigestEnhance.vue";
import "./custom.css";

const Layout = defineComponent({
  setup(_props, { slots }) {
    const route = useRoute();
    const isHome = route.path === "/" || route.path.endsWith("/index.html");
    const layoutClass = ["site-layout", isHome ? "home-layout" : ""]
      .filter(Boolean)
      .join(" ");
    return () =>
      h(
        DefaultTheme.Layout,
        { class: layoutClass },
        {
          ...slots,
          "doc-top": () => [
            slots["doc-top"]?.(),
            h(NewsDigestEnhance),
          ],
        },
      );
  },
});

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component("NewsArchive", NewsArchive);
  },
};
