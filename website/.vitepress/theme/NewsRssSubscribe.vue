<script setup>
import { ref } from "vue";

defineProps({
  compact: { type: Boolean, default: false },
});

const FEED_URL = "https://lp-imagine.github.io/penn-notes/news/feed.xml";
const copied = ref(false);

async function copyFeed() {
  try {
    await navigator.clipboard.writeText(FEED_URL);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    window.prompt("复制 RSS 地址：", FEED_URL);
  }
}

const feedlyUrl = `https://feedly.com/i/subscription/feed/${encodeURIComponent(FEED_URL)}`;
</script>

<template>
  <div class="news-rss-subscribe" :class="{ 'news-rss-subscribe--compact': compact }">
    <button type="button" class="news-rss-btn" @click="copyFeed">
      <svg
        class="news-rss-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M4 11a9 9 0 0 1 9 9" />
        <path d="M4 4a16 16 0 0 1 16 16" />
        <circle cx="5" cy="19" r="1" fill="currentColor" stroke="none" />
      </svg>
      <span>{{ copied ? "已复制订阅地址" : "RSS 订阅" }}</span>
    </button>
    <template v-if="!compact">
      <p class="news-rss-hint">
        点击复制地址，粘贴到
        <a :href="feedlyUrl" target="_blank" rel="noopener noreferrer">Feedly</a>
        等阅读器
      </p>
      <code class="news-rss-url">{{ FEED_URL }}</code>
    </template>
  </div>
</template>
