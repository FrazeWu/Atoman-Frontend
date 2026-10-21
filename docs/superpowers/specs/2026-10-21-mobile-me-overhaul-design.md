# 移动端 Me（个人中心与全站资产 Hub）重构设计文档

## 1. 目标与定位

将移动端 `/me`（`ProfileMobileView.vue`）系统性升级为符合 **Pure-White Double-Notch Minimal System** 规范的 **全站聚合资产与数字生活中心型（Option A）** 个人主页。

作为全站的核心个人中心，它不仅承载用户身份、编辑资料与账号系统设置，还负责聚合用户在音乐、阅读、博客、Feed、Studio 等多空间产生的生活足迹与资产入口。

---

## 2. 设计规范对齐

1. **纯白表面（R1）**：
   - 基础底色统一采用 `#ffffff` / `var(--a-color-bg)`。
   - 严禁未经定义的灰色块或深色渐变底板。
2. **柔和分界（R2）**：
   - 边线使用 `var(--a-color-border-soft, #e2e8f0)`，分割线与边框克制纤细。
3. **小圆角（R4）**：
   - 全局卡片与控件使用 4px 微圆角（`var(--a-radius-card, 4px)` / `var(--a-radius-control, 4px)`）。杜绝 999px 大药丸。
4. **克制字重（R5）**：
   - 标题与人名使用 500 / 600 字重，杜绝 700 / 800 bold。
5. **纯净用户文案（R7）**：
   - 杜绝技术黑话（无 System、Dev、Config、API、内部等词汇）。
6. **SF Symbols 几何线性图标**：
   - 使用统一 1.6px stroke 的 `MIcon`（`music`, `books`, `studio`, `bookmark`, `notes`, `edit`, `sun`, `moon`, `shield`, `chevron-right`, `bell`, `settings`, `external-link` 等）。

---

## 3. 架构与界面板块构成

页面由上至下划分为 5 大清晰模块：

### 3.1 个人名片与公开主页入口（Header Profile Card）
- **左侧**：64px 4px 圆角头像 `MAvatar`（支持真实头像与名字首字母兜底）。
- **右侧**：显示名称（Display Name，18px 600 字重）、Handle（`@username`，13px 次级灰）。
- **个性签名**：支持单行/多行自然简介。
- **操作行**：
  - “编辑资料” 按钮（微型 4px 边框按钮，点击拉起 `MSheet` 快速修改昵称与签名）。
  - “公开主页” 按钮（点击跳转公开个人主页 `/posts/me` 或 `/users/:username`）。

### 3.2 全站核心数据看板（Multi-Space Stats 4-Grid）
- 4 列等宽卡片指标，直观汇总跨模块资产：
  1. **文章 / 短笺**：已发布创作篇数 -> 点击跳转 `/posts/me`。
  2. **在读书籍**：书架中阅读中本数 -> 点击跳转 `/books/shelf`。
  3. **全站收藏**：收藏与稍后读条数 -> 点击跳转 `/feed/starred`。
  4. **关注者**：社交关注数量。

### 3.3 空间足迹与快捷入口（Space Footprints Hub）
- 模块标题：“空间足迹”。
- 2x2 网格或列表，直达高频场景：
  - 🎵 **音乐收听**：“最近播放与我的歌单” -> 直达 `/music/me`。
  - 📚 **阅读记录**：“在读图书与书摘划线” -> 直达 `/books/shelf`。
  - ✍️ **内容创作**：“Studio 草稿与创作管理” -> 直达 `/studio`。
  - 🔖 **收藏队列**：“已星标动态与稍后阅读” -> 直达 `/feed/starred`。

### 3.4 偏好与系统设置（Settings & Preferences）
- 模块标题：“偏好与设置”。
- 纯白嵌入式卡片列表（Grouped Inset List），每行附带图标、名称、状态与右箭头：
  - **外观模式**：浅色 / 深色，点击切换，保留 `[data-testid="settings-theme-toggle"]`。
  - **账号安全**：邮箱绑定、登录密码状态。
  - **消息通知**：免打扰与通知直达 `/inbox/notifications`。
  - **本地缓存**：显示占用大小（如 12.4 MB），点击清理并提示。
  - **关于 Atoman**：应用版本、服务条款与隐私说明。

### 3.5 退出登录（Logout Section）
- 底部次级危险/次级样式按钮：`[data-testid="logout-btn"]`，居中文字“退出登录”。

### 3.6 资料编辑抽屉（Edit Profile Sheet）
- 采用移动端 `MSheet`，表单包含：
  - 昵称输入框（`MInput`）
  - 个人简介多行输入框
  - 保存与取消按钮

---

## 4. 路由与向后兼容约束

1. 保持现有测试通过：`renders user profile card with avatar, bio, and stats`、`renders theme mode switch and logout action`。
2. 保留原有 testid：`profile-card`, `settings-theme-toggle`, `logout-btn`。
3. 支持 `props.user` 注入与 `useAuthStore` 响应式联动。
4. 移动端顶栏在进入 `/me` 时，显示“个人中心”，让用户拥有确定感。
