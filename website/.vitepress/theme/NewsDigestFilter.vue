<script setup>
import { onMounted, onUnmounted, ref } from "vue";
const sections = ["全部", "业界", "产品", "模型", "开源", "开发者工具", "前端"];
const active = ref("全部");
let sectionsRoot = null;

function applyFilter() {
  if (!sectionsRoot) return;
  const nodes = sectionsRoot.querySelectorAll(".news-section");
  nodes.forEach((node) => {
    const sec = node.getAttribute("data-section") || "";
    const show = active.value === "全部" || active.value === sec;
    node.style.display = show ? "" : "none";
  });
}

onMounted(() => {
  sectionsRoot = document.querySelector(".vp-doc");
  applyFilter();
});

onUnmounted(() => {
  sectionsRoot = null;
});

function setActive(sec) {
  active.value = sec;
  applyFilter();
}
</script>

<template>
  <div class="news-filter news-filter--digest" role="tablist" aria-label="栏目筛选">
    <button
      v-for="sec in sections"
      :key="sec"
      type="button"
      class="news-filter-btn"
      :class="{ 'is-active': active === sec }"
      role="tab"
      :aria-selected="active === sec"
      @click="setActive(sec)"
    >
      {{ sec }}
    </button>
  </div>
</template>
