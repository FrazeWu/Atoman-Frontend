# Atoman Frontend

Vue 3 前端应用，负责 Studio、RSS、论坛、辩题、音乐档案库等页面与交互。

## Tech Stack

- Vue 3.5
- Vite
- TypeScript 5.9（strict）
- Pinia 3
- Vue Router 4
- Tailwind CSS v4
- Playwright
- Vitest

## Commands

```bash
bun install
bun run dev
bun run build
bun run type-check
bun run test:unit
bun run test:e2e
```

## Directory Architecture

| Path | 职责 |
|---|---|
| `src/views/` | 页面组件 |
| `src/components/` | 可复用 UI 组件 |
| `src/stores/` | Pinia 状态 |
| `src/composables/` | 组合式逻辑 |
| `src/router.ts` | 路由定义 |
| `public/` | 静态资源 |
| `tests/e2e/` | Playwright 端到端测试 |
| `tests/unit/` | Vitest 单元测试 |

## Rules

- UI 实现遵循 `.claude/rules/frontend-ui.md`
- 组件与风格抽象遵循 `.claude/rules/design_system.md`
- 路由只表达空间内位置，不恢复 `/blog`、`/music` 等模块前缀
- 修改完成前必须运行至少 `bun run type-check`
