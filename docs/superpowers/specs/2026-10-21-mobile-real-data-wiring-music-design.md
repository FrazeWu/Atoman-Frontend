# 移动端真实数据接入设计规范：全局会话与音乐模块（第 1 站）

## 1. 目标与背景

用户指出当前移动端多模块存在未接入真实数据、回退为假数据（如默认假用户名、写死假列表、假统计指标）的问题。

本文档制定：
1. **全局移动端会话静默恢复机制**与**统一访客引导卡片 (`MGuestCard.vue`)**；
2. **第 1 站：音乐模块（`/music/me`）真实数据全面接入与闭环**。

---

## 2. 全局基础机制

### 2.1 移动端自动会话恢复 (Session Auto-Restore)
- **问题**：移动端公共路由守卫之前未对 `restoreSession()` 进行静默尝试，导致已登录用户在非 `requiresAuth` 路由上展示为访客。
- **方案**：
  - 在 `apps/mobile/MobileApp.vue` 的 `onMounted` 阶段执行 `void authStore.restoreSession().catch(() => {})`。
  - 在 `apps/mobile/mobileRoutes.ts` 中，为所有“我的”页面（`/music/me`, `/posts/me`, `/books/me`, `/feed/me`, `/inbox/me`）显式标记 `meta: { restoreSession: true }`，确保路由守卫进入前尝试静默唤醒。

### 2.2 统一纯白访客引导组件 (`MGuestCard.vue`)
- **路径**：`apps/mobile/components/ui/MGuestCard.vue`
- **设计风格**：Pure-White Minimal System (4px 微圆角，纯白卡片底板，柔和边框，500 字重，无大药丸)。
- **Props**：
  - `title`: 引导标题（如“登录以同步你的音乐”）
  - `description`: 描述说明（如“登录后可畅享收藏专辑、自建歌单与跨端收听历史。”）
  - `actionText`: 动作按钮文案（默认“立即登录”）
  - `icon`: SF Symbols 线性图标名称（如 `music`、`books`、`blog` 等）
  - `loginRedirect`: 登录成功后的回跳路由（默认当前路由路径）
- **交互**：点击登录按钮跳转 `/login?redirect=...`。

---

## 3. 音乐模块“我的” (`MusicMeView.vue`) 真实数据架构

### 3.1 访客态与已登录态切换
- **访客态**：不再展示“音乐爱好者 @music_listener”假名片与“0 0 0”假统计，而是展示 `MGuestCard`。
- **登录态**：真实展示 `authStore.user` 的头像 `MAvatar`、显示名称 `display_name || username` 与 `@username`。

### 3.2 跨模块真实数据 API 链路
1. **我的收藏 (Starred)**：
   - 真实 API：
     - `listAlbumBookmarks({ page: 1, page_size: 50 })` (专辑收藏)
     - `listArtistBookmarks({ page: 1, page_size: 50 })` (关注艺人)
     - `listPlaylistBookmarks({ page: 1, page_size: 50 })` (收藏歌单)
   - 聚合计算真实收藏总数，并呈现实体卡片（封面图、标题、类型标签、副标题）。
   - 点击真实跳转对应详情页（`/music/album/:id`、`/music/playlist/:id`、`/music/artist/:id`）。
2. **收听历史 (Listening History)**：
   - 真实 API：`listMusicListeningHistory({ page: 1, page_size: 50 })`。
   - 映射到统一 `Song` 结构，序号两位对齐（`01`, `02`...），格式化时间分秒。
   - 点击歌曲直接调用 `audioPlayerStore.playSong(song)` 启动移动端底栏播放器。
3. **我的歌单 (User Playlists)**：
   - 真实 API：`listMusicPlaylists({ page: 1, page_size: 50 })`。
   - 支持实时新建歌单：调用 `createMusicPlaylist({ name })`，新建成功后置顶更新歌单列表。
   - 点击歌单直达 `/music/playlist/:id`。

### 3.3 真实空状态与错误处理
- 各 Tab 独立处理空状态（如收藏为空时展示“暂无收藏专辑或歌单”，引导去 `/music`）。
- 接口异常时提供克制的重试机制。
