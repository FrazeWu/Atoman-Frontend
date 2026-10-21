# 移动端真实数据接入实施计划：全局会话与音乐模块

## 1. 任务概述

系统性解决移动端会话未静默恢复、假数据回退与未登录态显示假名的问题。实现全局自动恢复 Session、创建通用 `MGuestCard.vue`，并将 `apps/mobile/views/music/MusicMeView.vue` 彻底接入真实后端 API。

---

## 2. 任务清单

### Task 1: 移动端启动自动静默恢复 Session 与通用访客卡片
- 在 `apps/mobile/MobileApp.vue` 中，`onMounted` 增加静默调用 `authStore.restoreSession()`。
- 在 `apps/mobile/mobileRoutes.ts` 中，为所有“我的”页面添加 `meta: { restoreSession: true }`。
- 创建通用访客引导组件 `apps/mobile/components/ui/MGuestCard.vue`。

### Task 2: 单元测试套件：`tests/unit/mobile/music-me-real-data.spec.ts`
- 覆盖：
  1. 访客态（未登录）渲染 `MGuestCard`，点击登录跳转到带 redirect 参数的 `/login`。
  2. 已登录态真实渲染 `authStore.user` 的头像、名字与 Handle。
  3. 真实拉取并渲染收藏列表（专辑、艺人、歌单）与总计指标。
  4. 真实拉取收听历史，点击歌曲调用 `audioPlayerStore.playSong`。
  5. 真实拉取自建歌单列表，提交新建歌单表单时调用 `createMusicPlaylist` 并更新列表。

### Task 3: 深度重构 `apps/mobile/views/music/MusicMeView.vue`
- 集成 `MGuestCard`。
- 接入 `listAlbumBookmarks`、`listArtistBookmarks`、`listPlaylistBookmarks`、`listMusicListeningHistory`、`listMusicPlaylists`、`createMusicPlaylist`。
- 对齐 Pure-White Minimal 4px 规范与 SF Symbols 线性几何图标。

### Task 4: 验证与交付
- 运行测试：`bun run test:unit tests/unit/mobile/music-me-real-data.spec.ts tests/unit/mobile/music-views.spec.ts`。
- 检查类型：`bun run type-check`。
- 使用 Playwright 捕获登录态与访客态下的真实 `/music/me` 界面并对比核验。
- 提交代码并推送。
