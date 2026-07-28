# AI 动态

Penn Notes 的「AI 动态」栏目：每天早上自动抓取公开 RSS，经大模型摘要后生成静态日报，再部署到 GitHub Pages。

## 读者侧

打开 [AI 动态](../website/news/) 或首页「最新动态」。页面是静态 HTML，**不需要**站点实时联网。

## 生成流水线

1. `scripts/fetch-rss.mjs` — 拉 [`scripts/news/sources.json`](../scripts/news/sources.json) 中的 RSS，按北京时间过滤目标日
2. `scripts/summarize-news.mjs` — DeepSeek（或其它 OpenAI 兼容 API）去重 / 分类 / 中文摘要
3. 写入 `news/YYYY-MM/ai-news-YYYY-MM-DD.md`
4. `scripts/resolve-news-images.mjs` — 从原文抓 `og:image`（HTTPS 外链优先；失败则落盘 `website/public/news/`）
5. push 触发现有 CI 构建部署

> 注意：Actions 用 `GITHUB_TOKEN` 推送 **不会** 再触发另一个 workflow。因此 `daily-news.yml` 在生成后会**自行 build 并部署到 gh-pages**，不依赖 CI。

定时：GitHub Actions [`.github/workflows/daily-news.yml`](../.github/workflows/daily-news.yml)，每天 **北京时间 07:00**（UTC 23:00）汇总 **昨天**。

> GitHub 内置 `schedule` 可能延迟几十分钟甚至更久。推荐用外部定时服务调 `workflow_dispatch`（见下）。

## 外部定时触发（推荐）

比 GitHub `schedule` 更准时。支持两种方式：

### 方式 A：`workflow_dispatch`（cron-job.org 等）

1. 创建 GitHub Personal Access Token（`repo` 或 `workflow` 权限）
2. 在 [cron-job.org](https://cron-job.org) 新建任务，每天 **07:00 北京时间** 执行：

```bash
curl -sS -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer <你的PAT>" \
  https://api.github.com/repos/lp-Imagine/penn-notes/actions/workflows/daily-news.yml/dispatches \
  -d '{"ref":"master"}'
```

也可直接运行仓库脚本（需先 `export GITHUB_TOKEN=ghp_xxx`）：

```bash
bash scripts/trigger-daily-news.sh
```

### 方式 B：`repository_dispatch`

```bash
curl -sS -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer <你的PAT>" \
  https://api.github.com/repos/lp-Imagine/penn-notes/dispatches \
  -d '{"event_type":"daily-news"}'
```

内置 `schedule` 仍保留作备用。

## Secrets

仓库 Settings → Secrets and variables → Actions：

| Secret | 必填 | 说明 |
|--------|------|------|
| `LLM_API_KEY` | 是 | DeepSeek / OpenAI 等 API Key |
| `LLM_BASE_URL` | 否 | 默认 `https://api.deepseek.com/v1` |
| `LLM_MODEL` | 否 | 默认 `deepseek-chat` |

无 `LLM_API_KEY` 时脚本仍会写日报，但只用启发式摘要（质量较差）。

## 本地命令

```bash
# 生成昨天的日报（需 LLM_API_KEY）
export LLM_API_KEY=sk-xxx
npm run news:daily

# 指定日期 / 覆盖已有
node scripts/generate-daily-news.mjs --date=2026-07-26 --force

# 仅补配图
npm run news:images

# 生成本周周报（汇总近 7 天日报，不调 LLM）
npm run news:weekly

# 同步到 website 并预览
npm run sync:news && npm run build:home && npm run dev
```

## RSS 订阅

AI 动态提供 RSS，地址：

`https://lp-imagine.github.io/penn-notes/news/feed.xml`

本地构建后由 `npm run sync:news` 自动生成 `website/public/news/feed.xml`。可用 Feedly、Follow 等阅读器订阅。

## 周报

每周日 workflow 会自动汇总近 7 天日报生成周报（`ai-news-week-YYYY-MM-DD.md`），每栏目最多 3 条，不额外调用 LLM。

```bash
npm run news:weekly
node scripts/generate-weekly-news.mjs --date=2026-07-27 --force
```

## 质量监控

每次日报生成后写入 `news/.state/last-run.json`（条目数、栏目分布、RSS 成功/失败）。源健康见 `news/.state/feed-health.json`。

## 栏目

参考主流科技/AI 资讯的常见切法，并保留本站特色：

| 栏目 | 对应主流常见栏 | 收什么 |
|------|----------------|--------|
| 业界 | Industry / Business | 融资、并购、裁员、监管、市场 |
| 产品 | Products / Apps | 应用与产品发布、功能、定价 |
| 模型 | Models / Research | 新模型、API、评测与能力变化 |
| 开源 | Open Source | 仓库、协议、社区项目 |
| 开发者工具 | DevTools（本站加重） | 编码助手、IDE、Agent、MCP |
| 前端 | Web / Frontend（本站特色） | 框架、构建、样式、DX |

提示词要求：**有价值的业界/产品/模型新闻都要收**，不再因为「不够前端」而丢掉。

每条为中文标题 + 编辑向段落，结尾「对读者：」。需配置 `LLM_API_KEY`。

改源：`scripts/news/sources.json`；另抓 GitHub Trending。

## 排查

- **页面没更新**：多半是日报已 commit，但旧版 workflow 用 `GITHUB_TOKEN` 推送不会触发 CI。现在 daily-news 会自行部署；也可手动跑 CI → Run workflow
- **RSS 失败**：日志里会列出失败源，详情见 `news/.state/feed-health.json`
- **质量差 / 英文标题**：多半没配 `LLM_API_KEY`，或用了 `--allow-heuristic`
- **LLM 限流**：workflow 失败不会空 commit，可用 Actions → Daily AI News → Run workflow 重跑
- **已有日期跳过**：默认不覆盖；加 `--force`
- **配图缺失**：部分站点无 og 图或拦截抓取，属正常；可事后 `npm run news:images`
