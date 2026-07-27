<script setup>
import { useRoute } from "vitepress";
import NewsDigestFilter from "./NewsDigestFilter.vue";

const route = useRoute();
const isDigest = /\/news\/\d{4}-\d{2}\/ai-news-/.test(route.path);
</script>

<template>
  <NewsDigestFilter v-if="isDigest" />
</template>
