# 音乐播放器子组件拆解与外壳瘦身实施计划 (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将巨型单体组件 `AudioPlayer.vue` (1878 行) 拆解为 3 个高内聚子组件 (`AudioPlayerTrackInfo`, `AudioPlayerControlsHub`, `AudioPlayerFeatureStrip`)，抽离模块化样式文件 `styles/audioPlayer.css`，容器精简至 300 行以内，同时保持全部既有单测与样式契约 100% 绿色通过。

**Architecture:** 按照职责正交分离原则，将播放条划分为“曲目身份与动作域 (TrackInfo)”、“中置播放调度域 (ControlsHub)”、“右侧辅助工具域 (FeatureStrip)”三大子组件；容器 `AudioPlayer.vue` 专职处理折叠状态、手势触摸、快捷键与侧边抽屉联动；同时严格维持 `tests/unit/components/music/AudioPlayer.spec.ts` 的 DOM/类名与选择器契约。

**Tech Stack:** Vue 3.4+, Pinia 2.1+, TypeScript 5.8 (Strict), Vitest, Happy-DOM, Tailwind CSS v4.

## Global Constraints

- **严格 0 阴影**：全局遵循 `box-shadow: none !important;`。
- **严格 4px 圆角**：交互元素与卡片统一遵循 `border-radius: 4px;`。
- **纯白纸张基底与无边框设计**：遵循 `#FFFFFF` 底色与无多余线条边框的极简悬浮设计。
- **测试契约红线**：`AudioPlayer.vue` 必须保持 `tests/unit/components/music/AudioPlayer.spec.ts` 源码正则检索所要求的样式与声明契约：
  - `@media (max-width: 767px) ... .player-inner { display: grid; grid-template-columns: minmax(0, 1fr) 116px 88px; }`
  - `class="feature-link"`
  - `const featureLabel = computed(() => (isPodcast.value ? "说明" : "词"))`
  - `@media (max-width: 767px) ... .player-controls-hub { position: static; transform: none; }`
  - `.progress-container { display: flex; align-items: center; }`
  - `.progress-container > :deep(.waveform-progress) { width: 100%; }`
  - `.feature-link { font-size: 12px; }`
  - `<Transition name="player-display" appear>`
  - `<ChevronRight :size="16" aria-hidden="true" />`
  - `.player-display-enter-active { animation: player-display-enter var(--a-motion-overlay)`
- **全量单测保护**：`AudioPlayer.spec.ts` 17 项测试必须 100% 通过（零修改测试代码）。

---

### Task 1: 拆解并构建 `AudioPlayerTrackInfo.vue` 子组件与独立单测

**Files:**
- Create: `src/components/music/player/AudioPlayerTrackInfo.vue`
- Create: `tests/unit/components/music/AudioPlayerTrackInfo.spec.ts`

**Interfaces:**
- Produces:
  ```vue
  <script setup lang="ts">
  import type { MusicPlaylistSummary } from '@/api/musicV1';
  import type { Song } from '@/entities/music';

  defineProps<{
    currentSong: Song;
    isPodcast: boolean;
    isPodcastEpisode: boolean;
    isMetaCollapsed: boolean;
    coverFallback: string;
    artistText: string;
    favoriteSongIds: Set<string>;
    playlists: MusicPlaylistSummary[];
    playlistLoadError: string;
  }>();

  defineEmits<{
    (e: 'toggle-lyrics'): void;
    (e: 'open-artist', artistId: string): void;
    (e: 'open-album', albumId: string): void;
    (e: 'toggle-favorite', songId: string): void;
    (e: 'guard-playlist-menu', event: MouseEvent): void;
    (e: 'retry-load-playlists'): void;
    (e: 'add-to-playlist', playlistId: string, songId: string, close?: () => void): void;
    (e: 'add-podcast-bookmark', episodeId: string | undefined): void;
    (e: 'add-podcast-listen-later', episodeId: string | undefined): void;
  }>();
  </script>
  ```

- [ ] **Step 1: 编写 `AudioPlayerTrackInfo.spec.ts` 单元测试**

创建 `tests/unit/components/music/AudioPlayerTrackInfo.spec.ts`：
```ts
import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import AudioPlayerTrackInfo from "@/components/music/player/AudioPlayerTrackInfo.vue";

function createTestRouter() {
	return createRouter({
		history: createMemoryHistory(),
		routes: [{ path: "/", component: { template: "<div />" } }],
	});
}

describe("AudioPlayerTrackInfo", () => {
	const defaultProps = {
		currentSong: {
			id: "song-101",
			title: "Midnight City",
			artist: "M83",
			album: "Hurry Up, We're Dreaming",
			album_id: "album-99",
			cover_url: "https://example.com/cover.jpg",
			artists: [{ id: 1, name: "M83" }],
		} as any,
		isPodcast: false,
		isPodcastEpisode: false,
		isMetaCollapsed: false,
		coverFallback: "M",
		artistText: "M83",
		favoriteSongIds: new Set<string>(["song-101"]),
		playlists: [],
		playlistLoadError: "",
	};

	it("renders track cover, title link, artist, and favorite status", () => {
		const wrapper = mount(AudioPlayerTrackInfo, {
			props: defaultProps,
			global: {
				plugins: [createTestRouter()],
				stubs: {
					AudioPlayerPlaylistPopover: true,
				},
			},
		});

		expect(wrapper.find(".player-info").exists()).toBe(true);
		expect(wrapper.find(".player-cover").attributes("src")).toBe("https://example.com/cover.jpg");
		expect(wrapper.find(".player-title").text()).toBe("Midnight City");
		expect(wrapper.find(".player-artist").text()).toContain("M83");
		expect(wrapper.find(".player-fav-btn").classes()).toContain("is-active");
	});

	it("emits toggle-lyrics when clicking cover", async () => {
		const wrapper = mount(AudioPlayerTrackInfo, {
			props: defaultProps,
			global: {
				plugins: [createTestRouter()],
				stubs: { AudioPlayerPlaylistPopover: true },
			},
		});

		await wrapper.find(".cover-wrap").trigger("click");
		expect(wrapper.emitted("toggle-lyrics")).toBeTruthy();
	});

	it("emits toggle-favorite when clicking heart button", async () => {
		const wrapper = mount(AudioPlayerTrackInfo, {
			props: defaultProps,
			global: {
				plugins: [createTestRouter()],
				stubs: { AudioPlayerPlaylistPopover: true },
			},
		});

		await wrapper.find(".player-fav-btn").trigger("click");
		expect(wrapper.emitted("toggle-favorite")?.[0]).toEqual(["song-101"]);
	});

	it("renders podcast action buttons when isPodcastEpisode is true", () => {
		const wrapper = mount(AudioPlayerTrackInfo, {
			props: {
				...defaultProps,
				isPodcast: true,
				isPodcastEpisode: true,
				currentSong: {
					id: "podcast:1",
					title: "Podcast Ep 1",
					source_id: "ep-1",
				} as any,
			},
			global: {
				plugins: [createTestRouter()],
				stubs: { AudioPlayerPlaylistPopover: true },
			},
		});

		expect(wrapper.find('button[title="收藏单集"]').exists()).toBe(true);
		expect(wrapper.find('button[title="稍后听"]').exists()).toBe(true);
	});
});
```

- [ ] **Step 2: 运行测试验证其失败**

运行：`bun run test:unit tests/unit/components/music/AudioPlayerTrackInfo.spec.ts`
预期：FAIL，找不到组件模块。

- [ ] **Step 3: 实现 `src/components/music/player/AudioPlayerTrackInfo.vue`**

抽离曲目封面、标题、艺术家、专辑跳转、收藏及歌单按钮，并携带专属 scoped 样式。

- [ ] **Step 4: 运行测试验证其通过**

运行：`bun run test:unit tests/unit/components/music/AudioPlayerTrackInfo.spec.ts`
预期：PASS（4 tests pass）。

- [ ] **Step 5: 提交**

```bash
git add src/components/music/player/AudioPlayerTrackInfo.vue tests/unit/components/music/AudioPlayerTrackInfo.spec.ts
git commit -m "feat(player): create AudioPlayerTrackInfo subcomponent"
```

---

### Task 2: 拆解并构建 `AudioPlayerControlsHub.vue` 子组件与独立单测

**Files:**
- Create: `src/components/music/player/AudioPlayerControlsHub.vue`
- Create: `tests/unit/components/music/AudioPlayerControlsHub.spec.ts`

**Interfaces:**
- Produces:
  ```vue
  <script setup lang="ts">
  defineProps<{
    isPlaying: boolean;
    playbackError: unknown;
    isPodcast: boolean;
    playbackRate: number;
    playbackMode: 'loop' | 'single' | 'random';
  }>();

  defineEmits<{
    (e: 'skip', seconds: number): void;
    (e: 'play-previous'): void;
    (e: 'toggle-play'): void;
    (e: 'retry-playback'): void;
    (e: 'play-next'): void;
    (e: 'cycle-rate'): void;
    (e: 'cycle-mode'): void;
  }>();
  </script>
  ```

- [ ] **Step 1: 编写 `AudioPlayerControlsHub.spec.ts` 单元测试**

创建 `tests/unit/components/music/AudioPlayerControlsHub.spec.ts`：
```ts
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import AudioPlayerControlsHub from "@/components/music/player/AudioPlayerControlsHub.vue";

describe("AudioPlayerControlsHub", () => {
	const defaultProps = {
		isPlaying: false,
		playbackError: null,
		isPodcast: false,
		playbackRate: 1.0,
		playbackMode: "loop" as const,
	};

	it("renders playback buttons and emits actions", async () => {
		const wrapper = mount(AudioPlayerControlsHub, {
			props: defaultProps,
		});

		expect(wrapper.find(".player-controls-hub").exists()).toBe(true);
		expect(wrapper.find(".main-play-btn").text()).toBe("播放");

		await wrapper.find(".main-play-btn").trigger("click");
		expect(wrapper.emitted("toggle-play")).toBeTruthy();

		await wrapper.find('button[aria-label="上一首"]').trigger("click");
		expect(wrapper.emitted("play-previous")).toBeTruthy();

		await wrapper.find('button[aria-label="下一首"]').trigger("click");
		expect(wrapper.emitted("play-next")).toBeTruthy();
	});

	it("renders error retry state when playbackError occurs", async () => {
		const wrapper = mount(AudioPlayerControlsHub, {
			props: {
				...defaultProps,
				playbackError: new Error("Audio decode error"),
			},
		});

		const playBtn = wrapper.find(".main-play-btn");
		expect(playBtn.classes()).toContain("has-error");
		expect(playBtn.text()).toBe("重试");

		await playBtn.trigger("click");
		expect(wrapper.emitted("retry-playback")).toBeTruthy();
	});

	it("renders skip buttons and playback rate button in podcast mode", async () => {
		const wrapper = mount(AudioPlayerControlsHub, {
			props: {
				...defaultProps,
				isPodcast: true,
				playbackRate: 1.5,
			},
		});

		expect(wrapper.find('button[aria-label="后退 15 秒"]').exists()).toBe(true);
		expect(wrapper.find('button[aria-label="前进 15 秒"]').exists()).toBe(true);
		expect(wrapper.find(".player-rate-btn").text()).toBe("1.5x");

		await wrapper.find('button[aria-label="后退 15 秒"]').trigger("click");
		expect(wrapper.emitted("skip")?.[0]).toEqual([-15]);

		await wrapper.find(".player-rate-btn").trigger("click");
		expect(wrapper.emitted("cycle-rate")).toBeTruthy();
	});
});
```

- [ ] **Step 2: 运行测试验证其失败**

运行：`bun run test:unit tests/unit/components/music/AudioPlayerControlsHub.spec.ts`
预期：FAIL，找不到组件模块。

- [ ] **Step 3: 实现 `src/components/music/player/AudioPlayerControlsHub.vue`**

实现中置控制台，包含上一首、主播放按钮、下一首、15s快进退、倍速与循环模式，自带纯净 scoped 样式。

- [ ] **Step 4: 运行测试验证其通过**

运行：`bun run test:unit tests/unit/components/music/AudioPlayerControlsHub.spec.ts`
预期：PASS（3 tests pass）。

- [ ] **Step 5: 提交**

```bash
git add src/components/music/player/AudioPlayerControlsHub.vue tests/unit/components/music/AudioPlayerControlsHub.spec.ts
git commit -m "feat(player): create AudioPlayerControlsHub subcomponent"
```

---

### Task 3: 拆解并构建 `AudioPlayerFeatureStrip.vue` 子组件与独立单测

**Files:**
- Create: `src/components/music/player/AudioPlayerFeatureStrip.vue`
- Create: `tests/unit/components/music/AudioPlayerFeatureStrip.spec.ts`

**Interfaces:**
- Produces:
  ```vue
  <script setup lang="ts">
  defineProps<{
    featureLabel: string;
    volume: number;
    showQueue: boolean;
    queueCount: number;
  }>();

  defineEmits<{
    (e: 'toggle-lyrics'): void;
    (e: 'open-comments'): void;
    (e: 'set-volume', volume: number): void;
    (e: 'toggle-mute'): void;
    (e: 'toggle-queue'): void;
  }>();
  </script>
  ```

- [ ] **Step 1: 编写 `AudioPlayerFeatureStrip.spec.ts` 单元测试**

创建 `tests/unit/components/music/AudioPlayerFeatureStrip.spec.ts`：
```ts
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import AudioPlayerFeatureStrip from "@/components/music/player/AudioPlayerFeatureStrip.vue";

describe("AudioPlayerFeatureStrip", () => {
	const defaultProps = {
		featureLabel: "词",
		volume: 0.75,
		showQueue: false,
		queueCount: 5,
	};

	it("renders lyrics, comments, volume and queue controls", async () => {
		const wrapper = mount(AudioPlayerFeatureStrip, {
			props: defaultProps,
			global: {
				stubs: { AudioPlayerVolume: true },
			},
		});

		expect(wrapper.find(".player-features").exists()).toBe(true);
		expect(wrapper.find('button[aria-label="歌词"]').text()).toBe("词");
		expect(wrapper.find('button[aria-label="评论"]').text()).toBe("评");
		expect(wrapper.find(".queue-count").text()).toBe("5");

		await wrapper.find('button[aria-label="歌词"]').trigger("click");
		expect(wrapper.emitted("toggle-lyrics")).toBeTruthy();

		await wrapper.find('button[aria-label="评论"]').trigger("click");
		expect(wrapper.emitted("open-comments")).toBeTruthy();

		await wrapper.find(".queue-trigger").trigger("click");
		expect(wrapper.emitted("toggle-queue")).toBeTruthy();
	});

	it("highlights queue button when showQueue is active", () => {
		const wrapper = mount(AudioPlayerFeatureStrip, {
			props: {
				...defaultProps,
				showQueue: true,
			},
			global: {
				stubs: { AudioPlayerVolume: true },
			},
		});

		expect(wrapper.find(".queue-trigger").classes()).toContain("active");
	});
});
```

- [ ] **Step 2: 运行测试验证其失败**

运行：`bun run test:unit tests/unit/components/music/AudioPlayerFeatureStrip.spec.ts`
预期：FAIL，找不到组件模块。

- [ ] **Step 3: 实现 `src/components/music/player/AudioPlayerFeatureStrip.vue`**

包含词/说明按钮、评论按钮、`AudioPlayerVolume`、播放队列按钮与计数徽标。

- [ ] **Step 4: 运行测试验证其通过**

运行：`bun run test:unit tests/unit/components/music/AudioPlayerFeatureStrip.spec.ts`
预期：PASS（2 tests pass）。

- [ ] **Step 5: 提交**

```bash
git add src/components/music/player/AudioPlayerFeatureStrip.vue tests/unit/components/music/AudioPlayerFeatureStrip.spec.ts
git commit -m "feat(player): create AudioPlayerFeatureStrip subcomponent"
```

---

### Task 4: 抽离公共样式 `styles/audioPlayer.css` 并精简 `AudioPlayer.vue` 装配外壳

**Files:**
- Create: `src/components/music/styles/audioPlayer.css`
- Modify: `src/components/music/AudioPlayer.vue`
- Test: `tests/unit/components/music/AudioPlayer.spec.ts`

**Interfaces:**
- Produces: 精简后的 `AudioPlayer.vue`（从 1878 行瘦身至 350 行左右），负责编排子组件与抽屉联动。
- Consumes: `AudioPlayerTrackInfo`, `AudioPlayerControlsHub`, `AudioPlayerFeatureStrip`

- [ ] **Step 1: 创建 `src/components/music/styles/audioPlayer.css`**

将播放器外壳公共布局、动画（`player-display-enter` 等）、波形容器及媒体查询样式提取至独立 CSS 文件。

- [ ] **Step 2: 重构 `src/components/music/AudioPlayer.vue`**

在模板中使用 `AudioPlayerTrackInfo`、`AudioPlayerControlsHub`、`AudioPlayerFeatureStrip`，保留手势滑动、全局快捷键、Mini 模式与抽屉，并在组件中保留 `AudioPlayer.spec.ts` 所检索的关键契约声明与样式规则。

- [ ] **Step 3: 运行 `AudioPlayer.spec.ts` 全量验证**

运行：`bun run test:unit tests/unit/components/music/AudioPlayer.spec.ts`
预期：17/17 tests 100% PASS。

- [ ] **Step 4: 提交**

```bash
git add src/components/music/styles/audioPlayer.css src/components/music/AudioPlayer.vue
git commit -m "refactor(player): compose AudioPlayer using subcomponents and modular styles"
```

---

### Task 5: 全量类型检查、播放器组件全套回归测试与构建验证

**Files:**
- Test: 全量播放器与音乐相关测试套件

- [ ] **Step 1: 运行 TypeScript 严格类型检查**

运行：`bun run type-check`
预期：0 错误。

- [ ] **Step 2: 运行播放器全套单元测试**

运行：
```bash
bun run test:unit tests/unit/components/music/AudioPlayer*.spec.ts tests/unit/stores/player.spec.ts tests/unit/utils/audioEngine.spec.ts
```
预期：所有测试 100% PASS。

- [ ] **Step 3: 运行 Vite 生产构建**

运行：`bun run build`
预期：构建成功，退出码为 0。

- [ ] **Step 4: 提交并推送到远程**

```bash
git commit --allow-empty -m "chore(player): complete Phase 2 subcomponent decomposition and verification"
git push origin main
```
