# Atoman Frontend

## 简介

Atoman 的 Web 客户端，提供内容创作、订阅阅读、社区讨论和音乐档案管理等功能。

## 功能

- Blog 与短话：发布、频道、合集、订阅、收藏和阅读。
- Feed / RSS：订阅、搜索、过滤规则、稍后阅读、收藏和混合推荐。
- 音乐档案库：艺人、专辑、歌曲、歌单、播放、导入和歌词注释。
- 社区：论坛、辩题、播客、视频和人物时间线。
- Studio：频道、内容、数据、互动和发布管理。
- 通用能力：登录注册、点赞评论、通知私信、用户设置和响应式导航。

## 技术栈

- Vue 3
- Vite
- TypeScript
- Pinia
- Vue Router
- Tailwind CSS
- Vitest
- Playwright

## 开发

需要 Bun 1.3+，本地 Backend 默认运行在 `http://localhost:8080`。

```bash
cp .env.example .env.dev
bun install
bun run dev
```

常用检查：

```bash
bun run type-check
bun run test:unit
bun run build
```

开发环境读取 `.env.dev`，生产构建读取 `.env.production`。

## 部署

生产环境部署到 Cloudflare Pages，由 Cloudflare 提供 CDN。

- 构建命令：`bun run build`
- 输出目录：`dist`
- API 地址：`VITE_API_URL=https://api.atoman.org/api`
- 历史前端资产：GitHub Actions 会把每个 `main` 构建的 `dist/assets` 归档到 R2，Pages 在旧 hash 缺失时从归档返回正确的模块文件。仓库必须配置 `CLOUDFLARE_R2_RELEASE_ASSETS_TOKEN` secret，权限限定为 `atoman-frontend-releases` bucket 的对象读写。

短期 Feed 路线图见 [ROADMAP.md](./ROADMAP.md)，完整的产品、交付与质量规划见 [长期开发计划](./docs/plans/long-term-development-plan.md)。
