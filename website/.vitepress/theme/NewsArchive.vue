<script setup>
import { computed, ref } from "vue";
import items from "../news-items.generated.json";

const BASE = "/vuepressblog/";
const sections = ["全部", "业界", "产品", "模型", "开源", "开发者工具", "前端"];
const active = ref("全部");

const filtered = computed(() => {
  if (active.value === "全部") return items;
  return items.filter((item) => item.section === active.value);
});

function link(path) {
  return BASE + String(path).replace(/^\/+/, "");
}
</script>

<template>
  <div class="news-archive">
    <div class="news-filter" role="tablist" aria-label="栏目筛选">
      <button
        v-for="sec in sections"
        :key="sec"
        type="button"
        class="news-filter-btn"
        :class="{ 'is-active': active === sec }"
        role="tab"
        :aria-selected="active === sec"
        @click="active = sec"
      >
        {{ sec }}
      </button>
    </div>

    <p v-if="!filtered.length" class="home-empty">
      还没有内容，每天早上会自动更新最新动态。
    </p>

    <div v-else class="news-item-grid">
      <a
        v-for="(item, idx) in filtered"
        :key="`${item.digestSlug}-${idx}`"
        class="news-item-card"
        :class="{ 'news-item-card--media': !!item.image }"
        :href="link(item.digestLink)"
      >
        <img
          v-if="item.image"
          class="news-item-thumb"
          :src="item.image"
          alt=""
          loading="lazy"
        />
        <div class="news-item-body">
          <div class="news-item-tags">
            <span class="news-section-tag">{{ item.section }}</span>
            <span v-if="item.sourceName" class="news-source-tag">{{
              item.sourceName
            }}</span>
          </div>
          <span class="news-item-title">{{ item.title }}</span>
          <span class="news-item-meta">
            <time :datetime="item.itemDate">{{ item.itemDate }}</time>
            <span>阅读全文</span>
          </span>
        </div>
      </a>
    </div>
  </div>
</template>
