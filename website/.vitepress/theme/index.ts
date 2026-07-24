import { defineComponent, h } from "vue";
import { useRoute } from "vitepress";
import DefaultTheme from "vitepress/theme";
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
        { ...slots },
      );
  },
});

export default {
  extends: DefaultTheme,
  Layout,
};
