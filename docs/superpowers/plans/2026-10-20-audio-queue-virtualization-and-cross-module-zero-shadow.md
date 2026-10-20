# Audio Queue Virtualization & Cross-Module Zero-Shadow Refactoring Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement virtual windowed rendering & drag autoscroll in `AudioPlayerQueue.vue` for large queues (100+ tracks), and systematically eliminate lingering `box-shadow` rules across all remaining views and components to enforce the strict 0-shadow 4px-radius paper design system.

**Architecture:** 
- In `AudioPlayerQueue.vue`, implement a virtual windowing mechanism with top/bottom spacers when item count exceeds 40 and container height is measured, while gracefully rendering full list in testing/small lists to preserve 100% contract compatibility.
- In cross-module views and components (`music`, `podcast`, `books`, `feed`, `studio`, `blog`, `settings`, `admin`), systematically replace lingering `box-shadow` rules with 1px hairline borders (`var(--a-color-border-soft)`), subtle surface highlights (`var(--a-color-surface-muted)`), crisp focus outlines, and `border-radius: 4px;`.
- Verify with strict TypeScript type-checking, comprehensive unit test suite (52+ files, 577+ tests), and production build.

**Tech Stack:** Vue 3.4, Pinia 2, TypeScript 5.8, Tailwind CSS v4, Vitest, Happy-DOM.

## Global Constraints

- 严格 0 阴影：所有组件与页面遵循 `box-shadow: none !important;`，交互聚焦使用 `outline: 2px solid var(--a-color-primary); outline-offset: 1px;`。
- 严格 4px 圆角：卡片与交互元素统一遵循 `border-radius: var(--a-radius-card, 4px);` 或 `border-radius: 4px;`。
- 纯白纸张基底：容器与列表遵循 `#FFFFFF` 纸张底色与 `1px solid var(--a-color-border-soft)` 发丝线分割。
- 契约向前兼容红线：`AudioPlayerQueue.spec.ts` 与所有现有单测必须 100% 通过；DOM 选择器契约不变。
- 类型安全：`bun run type-check` 必须通过且 0 错误。

---

### Task 1: 播放队列虚拟滚动优化与拖拽边界自滚动 (`AudioPlayerQueue.vue`)

**Files:**
- Modify: `src/components/music/AudioPlayerQueue.vue`
- Test: `tests/unit/components/music/AudioPlayerQueue.spec.ts`

**Interfaces:**
- Consumes: `usePlayerStore()` (`queue`, `playedHistory`, `currentSong`, `moveQueueItem`, `playSong`, `playQueuedSong`, `toggleQueue`, `clearQueue`)
- Produces: Enhanced `AudioPlayerQueue.vue` supporting windowed rendering for queues > 40 items, top/bottom spacer heights, drag auto-scrolling, preserving all drag-and-drop slots, displacement classes, and sequence number input behavior.

- [ ] **Step 1: Inspect existing test coverage and add large queue virtualization test**

Add a test in `tests/unit/components/music/AudioPlayerQueue.spec.ts` verifying that when a large queue (e.g. 100 items) is present, the queue handles rendering efficiently and maintains drop slots and sequence editing correctly:

```ts
it("efficiently handles a large queue of 100 songs without breaking sequence reordering", async () => {
	const player = usePlayerStore();
	const songs: Song[] = Array.from({ length: 100 }, (_, i) => ({
		id: `song-${i + 1}`,
		title: `Song ${i + 1}`,
		artist: "Artist",
		audio_url: `/${i + 1}.mp3`,
	}));
	player.queue = songs;

	const wrapper = mount(AudioPlayerQueue);
	expect(wrapper.get(".queue-badge").text()).toBe("100 首");
	// Ensure queue items render and can be queried
	const items = wrapper.findAll(".queue-item");
	expect(items.length).toBeGreaterThan(0);

	// Sequence input on first rendered item works
	const firstInput = wrapper.findAll(".q-sequence__input")[0]!;
	firstInput.element.value = "10";
	await firstInput.trigger("change");
	expect(player.queue[9]!.id).toBe("song-1");
	wrapper.unmount();
});
```

- [ ] **Step 2: Run test to verify it passes or fails**

Run: `bun run test:unit tests/unit/components/music/AudioPlayerQueue.spec.ts`
Expected: PASS or verify existing behavior.

- [ ] **Step 3: Implement virtual windowing & auto-scroll in `AudioPlayerQueue.vue`**

In `src/components/music/AudioPlayerQueue.vue`:
1. In script:
   - Calculate item height: `const ITEM_HEIGHT = 52;` (row height including drop slot).
   - Track container scroll: `const queueContentRef = ref<HTMLElement | null>(null);`, `scrollTop = ref(0);`, `containerHeight = ref(0);`.
   - Setup `ResizeObserver` / scroll listener on `queueContentRef` to measure `containerHeight` and update `scrollTop`.
   - Threshold condition: `const isVirtualActive = computed(() => player.queue.length > 40 && containerHeight.value > 0);`
   - Visible items computation:
     - When `!isVirtualActive.value`: render `player.queue.map((song, index) => ({ song, index }))`.
     - When `isVirtualActive.value`: calculate `startIndex = Math.max(0, Math.floor(scrollTop.value / ITEM_HEIGHT) - 5)`, `endIndex = Math.min(player.queue.length, Math.ceil((scrollTop.value + containerHeight.value) / ITEM_HEIGHT) + 5)`.
     - `topSpacerHeight = startIndex * ITEM_HEIGHT`, `bottomSpacerHeight = (player.queue.length - endIndex) * ITEM_HEIGHT`.
   - Auto-scroll during drag:
     - In `handleQueueDragOver` / `handleQueueItemDragOver`: check `event.clientY` relative to `queueContentRef.getBoundingClientRect()`.
     - If within 40px of top: `queueContentRef.value.scrollTop -= 10;`.
     - If within 40px of bottom: `queueContentRef.value.scrollTop += 10;`.
2. In template:
   - For `activeTab === 'queue'`:
     - Render `<div v-if="topSpacerHeight > 0" :style="{ height: topSpacerHeight + 'px' }" class="queue-spacer" />`
     - Loop over visible items:
       `<template v-for="{ song, index } in visibleQueueItems" :key="player.playbackItemKey(song)">`
       ... drop slot, row, drag handle, sequence input ...
     - Render `<div v-if="bottomSpacerHeight > 0" :style="{ height: bottomSpacerHeight + 'px' }" class="queue-spacer" />`
     - Final drop slot at `player.queue.length`.

- [ ] **Step 4: Run unit tests to verify zero regressions**

Run: `bun run test:unit tests/unit/components/music/AudioPlayerQueue.spec.ts`
Expected: All 11 tests pass cleanly.

- [ ] **Step 5: Run type-check**

Run: `bun run type-check`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/music/AudioPlayerQueue.vue tests/unit/components/music/AudioPlayerQueue.spec.ts
git commit -m "feat(player): implement virtual windowing and drag autoscroll in AudioPlayerQueue"
```

---

### Task 2: 跨业务模块设计系统 0 阴影发丝线净化 (`Music`, `Podcast`, `Books`, `Feed`, `Studio`, `Blog`, `Admin`, `Settings`)

**Files:**
- Modify:
  - `src/views/music/DiscoverView.vue`
  - `src/views/music/HistoryView.vue`
  - `src/views/music/LibraryView.vue`
  - `src/views/music/SongsView.vue`
  - `src/views/podcast/PodcastFavoritesView.vue`
  - `src/views/podcast/PodcastHomeView.vue`
  - `src/views/podcast/PodcastShowView.vue`
  - `src/views/podcast/PodcastSubscriptionsView.vue`
  - `src/components/music/ArtistSelect.vue`
  - `src/components/books/BookReaderShell.vue`
  - `src/components/books/BookReaderSidebar.vue`
  - `src/components/books/BookReaderThumbnailStrip.vue`
  - `src/components/books/BookSelectionToolbar.vue`
  - `src/components/books/BookCreationFlowDrawer.vue`
  - `src/components/feed/FeedTimelineFooter.vue`
  - `src/components/feed/SubscriptionAddSheet.vue`
  - `src/views/feed/FeedReadingListView.vue`
  - `src/views/feed/FeedRecommendedView.vue`
  - `src/views/feed/FeedStarredView.vue`
  - `src/views/feed/FeedView.vue`
  - `src/views/feed/InboxPage.vue`
  - `src/views/studio/StudioChannelView.vue`
  - `src/views/studio/StudioInteractionsView.vue`
  - `src/components/blog/PostHeader.vue`
  - `src/components/admin/AdminUserFilterBar.vue`
  - `src/views/setting/SettingUsersView.vue`

- [ ] **Step 1: Audit and replace lingering `box-shadow` in Music and Podcast views**

- In `src/views/music/DiscoverView.vue`, `HistoryView.vue`, `SongsView.vue`:
  - Replace `box-shadow: inset 4px 0 0 var(--a-color-text), var(--a-shadow-sm);` with `border-left: 3px solid var(--a-color-text); box-shadow: none;`.
- In `src/views/music/LibraryView.vue`:
  - Replace `.music-library__play-indicator` and `.music-library__later-remove` `box-shadow: var(--a-shadow-sm);` with `border: 1px solid var(--a-color-border-soft); box-shadow: none;`.
- In `src/views/podcast/PodcastFavoritesView.vue`, `PodcastShowView.vue`, `PodcastSubscriptionsView.vue`:
  - Replace hover `box-shadow: var(--a-shadow-sm);` with `box-shadow: none; border-color: var(--a-color-border); background: var(--a-color-surface-muted);`.
- In `src/views/podcast/PodcastHomeView.vue`:
  - Replace `box-shadow: var(--a-shadow-sm);` with `box-shadow: none; border: 1px solid var(--a-color-border-soft);`.
- In `src/components/music/ArtistSelect.vue`:
  - Replace `box-shadow: var(--a-shadow-sm);` with `box-shadow: none; border: 1px solid var(--a-color-border-soft);`.

- [ ] **Step 2: Audit and replace lingering `box-shadow` in Books and Feed components**

- In `src/components/books/BookReaderShell.vue`:
  - Replace `box-shadow: var(--a-shadow-md);` with `border: 1px solid var(--a-color-border-soft); box-shadow: none;`.
- In `src/components/books/BookReaderSidebar.vue` & `BookReaderThumbnailStrip.vue`:
  - Replace `box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);` with `box-shadow: none; border: 1px solid var(--a-color-border-soft);`.
- In `src/components/books/BookSelectionToolbar.vue`:
  - Replace `box-shadow: var(--a-shadow-dropdown);` with `border: 1px solid var(--a-color-border-soft); box-shadow: none;`.
- In `src/components/books/BookCreationFlowDrawer.vue`:
  - Replace `box-shadow: var(--a-shadow-sm);` with `border: 1px solid var(--a-color-border-soft); box-shadow: none;`.
- In `src/components/feed/FeedTimelineFooter.vue`:
  - Replace `box-shadow: var(--a-shadow-sm);` with `box-shadow: none;`.
- In `src/components/feed/SubscriptionAddSheet.vue`:
  - Replace `box-shadow: var(--a-shadow-sm);` with `box-shadow: none; border: 1px solid var(--a-color-border-soft);`.
- In `src/views/feed/FeedReadingListView.vue`, `FeedRecommendedView.vue`, `FeedStarredView.vue`, `FeedView.vue`:
  - Replace `box-shadow: var(--a-shadow-sm);` with `box-shadow: none; border: 1px solid var(--a-color-border-soft);`.
- In `src/views/feed/InboxPage.vue`:
  - Replace `box-shadow: var(--a-shadow-lg);` with `border: 1px solid var(--a-color-border-soft); box-shadow: none;`.

- [ ] **Step 3: Audit and replace lingering `box-shadow` in Studio, Blog, Admin, Settings**

- In `src/views/studio/StudioChannelView.vue` and `StudioInteractionsView.vue`:
  - Replace hover `box-shadow: var(--a-shadow-sm);` with `box-shadow: none; border-color: var(--a-color-border);`.
- In `src/components/blog/PostHeader.vue`:
  - Replace `box-shadow: var(--a-shadow-sm);` with `box-shadow: none; border: 1px solid var(--a-color-border-soft);`.
- In `src/components/admin/AdminUserFilterBar.vue`:
  - Replace `box-shadow: var(--a-shadow-sm);` with `box-shadow: none; border: 1px solid var(--a-color-border-soft);`.
- In `src/views/setting/SettingUsersView.vue`:
  - Replace `box-shadow: var(--a-shadow-sm);` with `box-shadow: none; border: 1px solid var(--a-color-border-soft);`.

- [ ] **Step 4: Run unit tests across modules to verify zero regressions**

Run: `bun run test:unit tests/unit/components/music/ tests/unit/views/music/ tests/unit/views/podcast/ tests/unit/components/feed/ tests/unit/views/books/`
Expected: All tests pass.

- [ ] **Step 5: Run type-check**

Run: `bun run type-check`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/views/ src/components/
git commit -m "style(design-system): eliminate residual box-shadow rules across modules"
```

---

### Task 3: 全量跨模块测试套件、类型检查与生产构建校验

**Files:**
- Test: All unit test suites in `tests/unit/`
- Build verification

- [ ] **Step 1: Run full TypeScript strict type-check**

Run: `bun run type-check`
Expected: 0 errors.

- [ ] **Step 2: Run all unit test suites**

Run: `bun run test:unit`
Expected: 100% of tests passing across all test files.

- [ ] **Step 3: Run production build**

Run: `bun run build`
Expected: Build succeeds with exit code 0.

- [ ] **Step 4: Commit and tag completion**

```bash
git commit --allow-empty -m "chore: complete audio queue virtualization and cross-module zero-shadow refactoring"
```
