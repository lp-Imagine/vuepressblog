# Penn Notes

Penn 的前端笔记站（VitePress）。线上：https://lp-imagine.github.io/vuepressblog/

## 本地开发

需要 Node.js 20+。

```bash
npm install
npm run migrate   # 仅首次：从旧 docs/ 迁到 website/
npm run dev
```

打开终端提示的本地地址。

## 常用命令

```bash
npm run dev           # 开发
npm run build         # ingest + 首页/侧栏 + 构建 + 旧链跳转
npm run ingest        # 校验 website/sync 契约
npm run build:home    # 仅重建首页与侧栏
```

## ai-article 同步

约定见 [docs/SYNC.md](docs/SYNC.md)。入库目录：`website/sync/<section>/`。

## 部署

Push `master`/`main`，或发送 `repository_dispatch`（`blog-sync`）触发 GitHub Actions，发布到 `gh-pages`。需配置仓库 Secret `BLOG_TOKEN`。
