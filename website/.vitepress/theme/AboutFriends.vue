<script setup lang="ts">
const friends = [
  {
    name: "麋鹿鲁哟",
    desc: "大道至简，知易行难",
    avatar:
      "https://cdn.jsdelivr.net/gh/xugaoyi/image_store/blog/20200122153807.jpg",
    link: "https://www.cnblogs.com/miluluyo/",
  },
  {
    name: "XAOXUU",
    desc: "#IOS #Volantis 主题作者",
    avatar: "https://cdn.jsdelivr.net/gh/xaoxuu/assets@master/avatar/avatar.png",
    link: "https://xaoxuu.com",
  },
  {
    name: "Heo",
    desc: "爱折腾的设计师",
    avatar: "https://blog.zhheo.com/img/avatar.png",
    link: "https://blog.zhheo.com/",
  },
  {
    name: "二丫讲梵",
    desc: "学习 · 记录 · 分享",
    avatar: "https://wiki.eryajf.net/img/logo.png",
    link: "https://wiki.eryajf.net/",
  },
  {
    name: "YoungKbt World",
    desc: "故事由我书写，旅程由你见证",
    avatar: "https://cdn.jsdelivr.net/gh/Kele-Bingtang/static/user/avatar2.png",
    link: "https://notes.youngkbt.cn/",
  },
  {
    name: "Cubik 的小站",
    desc: "RECOMMENDED BY DR.CREATIVE",
    avatar:
      "https://cdn.jsdelivr.net/gh/Cubik65536/cubik-favicons@main/CubikLogo.png",
    link: "https://www.cubik65536.top/",
  },
  {
    name: "CloudNative Operations",
    desc: "专注云原生运维",
    avatar: "https://kubesre.com/img/logo.png",
    link: "https://kubesre.com/",
  },
  {
    name: "不器小窝",
    desc: "但知行好事，莫要问前程",
    avatar: "https://avatars.githubusercontent.com/u/866409?v=4",
    link: "https://xingcxb.com/",
  },
] as const;

const siteInfo = [
  "- name: Penn Notes",
  "  desc: 前端学习笔记 · 工程备忘 · AI 动态",
  "  avatar: https://lp-imagine.github.io/penn-notes/pn-favicon-32.png",
  "  link: https://lp-imagine.github.io/penn-notes/",
].join("\n");
</script>

<template>
  <section class="about-block about-block--friends" id="friends">
    <h2 class="about-block-title">友情链接</h2>
    <p class="about-friends-lead">一些常逛的博客与站点。欢迎互换友链。</p>

    <div class="about-friends-grid">
      <a
        v-for="item in friends"
        :key="item.link"
        class="about-friend"
        :href="item.link"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          class="about-friend-avatar"
          :src="item.avatar"
          alt=""
          loading="lazy"
        />
        <span class="about-friend-body">
          <span class="about-friend-name">{{ item.name }}</span>
          <span class="about-friend-desc">{{ item.desc }}</span>
        </span>
      </a>
    </div>

    <div class="about-friends-apply">
      <p class="about-friends-apply-title">互换友链</p>
      <p class="about-friends-apply-text">
        先添加本站，再通过
        <a
          href="https://github.com/lp-Imagine"
          target="_blank"
          rel="noopener noreferrer"
        >GitHub</a>
        联系我，附上站点信息：
      </p>
      <pre class="about-friends-code"><code>{{ siteInfo }}</code></pre>
    </div>
  </section>
</template>
