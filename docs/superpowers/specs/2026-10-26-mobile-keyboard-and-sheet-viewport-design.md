# 移动端软键盘防遮挡与视口自适应设计规范 (Mobile Keyboard & Viewport Adaptation)

## 1. 目标与背景
在移动端 Web（尤其 iOS Safari 与 Android Chrome）环境下，软键盘弹出会缩小物理可视区域（Visual Viewport），而传统的 `position: fixed; bottom: 0;` 或 `max-height: 85vh` 仍基于视口布局（Layout Viewport），导致：
1. **吸底操作栏被遮挡**：如详情页吸底回复栏（`detail-reply-bar`）直接被虚拟键盘覆盖，用户看不见自己输入的文字；
2. **底部弹层（Bottom Sheet）操作区截断**：如短笺发布抽屉（`ShortNoteComposerSheet.vue`）底部“发布短笺”和“添加图片”操作区被键盘完全覆盖；
3. **iOS 自动缩放破坏排版**：输入框字号小于 16px（如 13px）时，iOS Safari 聚焦会自动触发整页缩放。

本设计旨在通过 `window.visualViewport` 监听机制、CSS 变量注入系统与自适应弹层改造，实现全流程无遮挡、平滑抬升与无抖动的移动端输入体验。

---

## 2. 总体架构设计

```
                    ┌─────────────────────────┐
                    │ window.visualViewport   │
                    └────────────┬────────────┘
                                 │ resize / scroll
                                 ▼
                    ┌─────────────────────────┐
                    │   useMobileKeyboard     │
                    │  (Composable Hook)      │
                    └────────────┬────────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           ▼                     ▼                     ▼
  --mobile-keyboard-height  --mobile-viewport-h   isKeyboardVisible
           │                     │                     │
           ▼                     ▼                     ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│      MSheet.vue      │ │ ShortNoteDetailMobile│ │ ShortNoteComposer    │
│  (max-height/padding)│ │   (吸底回复栏抬升)   │ │  (操作区常驻可视)    │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘
```

---

## 3. 详细模块设计

### 3.1 核心状态监听：`useMobileKeyboard`
- **文件路径**：`apps/mobile/composables/useMobileKeyboard.ts`
- **核心逻辑**：
  1. 监听 `window.visualViewport` 的 `resize` 与 `scroll` 事件；
  2. 计算键盘状态：
     - `keyboardHeight = Math.max(0, Math.round(window.innerHeight - visualViewport.height))`
     - `isKeyboardOpen = keyboardHeight > 60`（过滤 iOS 底部地址栏收缩引起的微小变化，阈值设为 60px）
     - `visualViewportHeight = Math.round(visualViewport.height)`
  3. 将变量动态注入到宿主容器或 `:root`：
     - `--mobile-keyboard-height: ${keyboardHeight}px`
     - `--mobile-viewport-height: ${visualViewportHeight}px`
  4. 提供辅助工具函数：
     - `scrollIntoView(el: HTMLElement)`：在软键盘完全展开后平滑将光标所在元素滚动到中央。

### 3.2 通用弹层改造：`MSheet.vue`
- **文件路径**：`apps/mobile/components/ui/MSheet.vue`
- **改动要点**：
  1. 引入 `useMobileKeyboard()`；
  2. 面板最大高度限制改为：
     ```css
     max-height: calc(var(--mobile-viewport-height, 100dvh) * 0.88);
     ```
  3. 底部内边距动态随键盘抬升并过渡：
     ```css
     padding-bottom: calc(var(--mobile-keyboard-height, 0px) + env(safe-area-inset-bottom, 16px));
     transition: padding-bottom 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
     ```
  4. 内部 `.m-sheet__content` 开启弹性滚动与惯性滑动（`-webkit-overflow-scrolling: touch; overflow-y: auto;`）。

### 3.3 吸底回复栏改造：`ShortNoteDetailMobileView.vue`
- **文件路径**：`apps/mobile/views/blog/ShortNoteDetailMobileView.vue`
- **改动要点**：
  1. 吸底回复栏底部定位改造：
     ```css
     .detail-reply-bar {
       position: fixed;
       bottom: var(--mobile-keyboard-height, 0px);
       left: 0;
       right: 0;
       padding: 8px 16px calc(8px + env(safe-area-inset-bottom, 0px));
       transition: bottom 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
     }
     ```
  2. 修复输入框字号防 iOS Safari 强制缩放：
     ```css
     .reply-input {
       font-size: 16px; /* 强制 16px 消除 iOS 聚焦自动放大 */
       line-height: 1.4;
     }
     ```
  3. 聚焦时自动触发聚焦元素校正与视图居中。

### 3.4 短笺发布抽屉优化：`ShortNoteComposerSheet.vue`
- **文件路径**：`apps/mobile/views/blog/ShortNoteComposerSheet.vue`
- **改动要点**：
  1. 输入框文本区域自适应弹性高度，字号设置为 `16px`；
  2. 底部操作栏（“添加图片”、“字数统计”、“发布短笺”）在键盘弹起时始终锚定在键盘上方。

---

## 4. 全局设计规范约束 (Design System Compliance)
- **Zero Shadow**：所有弹层与吸底工具栏一律使用 `box-shadow: none !important;`，依赖 `border-top: 1px solid var(--a-color-border-soft, #e2e8f0)` 实现层次分割；
- **4px Border Radius**：统一使用 `var(--a-radius-control, 4px)` 或 `var(--a-radius-card, 4px)`；
- **Tokenization**：颜色统一采用 `--a-color-bg`、`--a-color-border-soft`、`--a-color-primary`；
- **文案规范**：保持克制用户态文案（“写下你的回复...”、“发布短笺”、“添加图片”），杜绝系统或开发者视角术语。

---

## 5. 测试与验证策略
1. **单元测试 (`tests/unit/mobile/MobileKeyboard.spec.ts`)**：
   - 测试 `window.visualViewport` 改变时 `keyboardHeight` 与 `isKeyboardOpen` 状态更新；
   - 测试 CSS 变量 `--mobile-keyboard-height` 的注入与卸载清理；
   - 测试 `MSheet.vue` 在软键盘弹出时 `padding-bottom` 自动适配与阈值回弹。
2. **端到端契约与类型检查**：
   - `bun run type-check` 0 errors；
   - `bun run test:unit tests/unit/mobile/` 全量通过；
   - `bun run build:mobile` 生产打包编译通过。
