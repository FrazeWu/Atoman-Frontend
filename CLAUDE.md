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

## Browser / Visual Companion

- 使用 brainstorming visual companion 时，不要直接运行默认后台启动命令；本环境会回收 `nohup` 后台进程，导致返回的 localhost URL 无法打开。
- 正确启动方式：用 Bash 工具的 `run_in_background: true` 执行 `~/.claude/skills/brainstorming/scripts/start-server.sh --project-dir /Users/fafa/projects/Atoman/Atoman-Frontend --host 0.0.0.0 --url-host localhost --foreground`。
- 启动后先读取 Bash 输出中的 `url`、`screen_dir`、`state_dir`，再用 `curl http://localhost:<port>/` 验证返回 200；不要用 `curl -I` 判断，因为该服务只处理 GET `/`，HEAD 会返回 404。
- 若日志出现 `fs.watch error: EMFILE`，只作为文件监听上限告警处理；只要 GET `/` 返回 200，视觉页仍可打开。
