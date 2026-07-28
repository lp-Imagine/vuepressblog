# Penn Notes

Penn 的前端笔记站（VitePress）。线上：https://lp-imagine.github.io/penn-notes/

## 本地开发

需要 Node.js **18+**（推荐 20：`nvm use 20`）。

```bash
npm install
npm run migrate   # 仅首次：从旧 docs/ 迁到 website/
npm run dev
```

打开终端提示的本地地址。

## 常用命令

```bash
npm run dev           # 开发
npm run build         # ingest + 资讯同步 + 首页/侧栏 + 构建
npm run ingest        # 校验 website/sync 契约
npm run sync:news     # 同步 news/ → website/news/
npm run news:daily    # 生成昨日 AI 动态（需 LLM_API_KEY）
npm run build:home    # 仅重建首页与侧栏
```

## AI 动态

每天早上自动抓取 RSS + 大模型摘要，按日归档。说明见 [docs/NEWS.md](docs/NEWS.md)。

栏目：**业界 · 产品 · 模型 · 开源 · 开发者工具 · 前端**（主流资讯覆盖面 + 本站开发者/前端特色）。

需配置仓库 Secret：`LLM_API_KEY`（可选 `LLM_BASE_URL` / `LLM_MODEL`）。

## ai-article 同步

约定见 [docs/SYNC.md](docs/SYNC.md)。入库目录：`website/sync/<section>/`。

## 部署

Push `master`/`main`，或发送 `repository_dispatch`（`blog-sync`）触发 GitHub Actions，发布到 `gh-pages`（使用内置 `GITHUB_TOKEN`，无需额外 Secret）。
