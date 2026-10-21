# 移动端 Me（个人中心与全站资产 Hub）重构实施计划

## 1. 任务概述

按照设计规范与 Option A 架构，将移动端 `apps/mobile/views/me/ProfileMobileView.vue` 升级为全站聚合资产与数字生活中心，完善 `MIcon.vue` 的必要图标（如 `chevron-right`、`external-link`），并补充单元测试。

---

## 2. 详细任务分解

### Task 1: 补充 `MIcon.vue` 缺失的线性几何图标
- 文件：`apps/mobile/components/ui/MIcon.vue`
- 补充图标：
  - `chevron-right`: `<polyline points="9 18 15 12 9 6" />`
  - `external-link`: `<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />`

### Task 2: 编写/更新单元测试 `tests/unit/mobile/me-space.spec.ts`
- 测试点：
  1. 渲染用户个人名片（头像、昵称、Handle、简介、编辑按钮、公开主页链接）。
  2. 渲染 4 栏全站资产看板（文章、在读、收藏、关注者），数值准确。
  3. 渲染 4 个空间足迹快捷入口（音乐、阅读、创作、收藏）。
  4. 渲染偏好与设置列表（外观模式切换、账号安全、通知偏好、缓存占用）。
  5. 点击编辑资料拉起 `MSheet` 抽屉，允许修改昵称与简介并提交。
  6. 兼容性验证：`settings-theme-toggle` 与 `logout-btn` 正常工作。

### Task 3: 深度重构 `apps/mobile/views/me/ProfileMobileView.vue`
- 遵循 Pure-White Double-Notch Minimal System。
- 组织为：
  - 顶部名片卡（MAvatar + 编辑资料 + 公开主页）
  - 4 列跨空间核心数据统计卡片
  - 空间足迹入口卡片组（🎵 音乐、📚 阅读、✍️ 创作、🔖 收藏）
  - 偏好与系统设置卡片组（带图标、说明与右向 chevron）
  - 退出登录按钮
  - 编辑资料底层弹窗 `MSheet`

### Task 4: 顶栏空间标题微调与移动端导航适配
- 在 `apps/mobile/MobileApp.vue` 中，当路由在 `/me` 时，向 `MobileTopbar` 传参 `title="个人中心"`。

### Task 5: 验证与验收
- 运行单元测试：`bun run test:unit tests/unit/mobile/me-space.spec.ts tests/unit/mobile/modules-views.spec.ts`。
- 运行全局类型检查：`bun run type-check`。
- 使用 Playwright 捕获 `/me` 高清截图并进行视觉核对。
- 提交并推送代码。
