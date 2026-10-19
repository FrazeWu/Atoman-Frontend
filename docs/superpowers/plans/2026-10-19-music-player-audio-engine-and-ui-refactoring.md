# 音乐播放器音频体验提升与架构拆解重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提升音乐播放器核心音频听感（微淡出防切歌爆音、智能音量记忆与静音切换），解耦 `player.ts` 中的播客领域依赖，并彻底净化播放器系列组件残留的 `box-shadow`，对齐 0 阴影发丝线纸张规范。

**Architecture:** 底层音频控制下沉到 `src/utils/audioEngine.ts`；播客领域持久化与生命周期埋点抽离到 `src/composables/usePodcastPlaybackAdapter.ts`；`src/stores/player.ts` 保持纯粹调度与 100% 向后兼容；`AudioPlayer.vue` 及子组件消除所有非规范阴影。

**Tech Stack:** Vue 3.4, Pinia 2, TypeScript 5.8 (strict), Vitest, Web Audio / HTML5 Audio APIs, Tailwind CSS v4.

## Global Constraints

- 严格 0 阴影：全局遵循 `box-shadow: none !important;`，交互元素与卡片统一遵循 `border-radius: 4px;`；
- 纯白纸张基底：遵循 `#FFFFFF` 纸张底色与 `1px solid var(--a-color-border-soft)` 发丝线分割；
- 契约向前兼容红线：`usePlayerStore` 对外导出的所有 state / getter / actions 签名必须 100% 保持一致，`tests/unit/stores/player.spec.ts` 全部 52 项单测必须 100% 通过；
- 样式契约红线：保持 `tests/unit/components/music/AudioPlayer.spec.ts` 依赖的 `.player-inner`、`.player-controls-hub`、`.progress-container` 等关键 CSS 规则与类名契约有效。

---

### Task 1: 音频引擎增加切歌微淡出防爆音 (`src/utils/audioEngine.ts`)

**Files:**
- Modify: `src/utils/audioEngine.ts`
- Test: `tests/unit/utils/audioEngine.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export async function transitionAudioSource(
    targetAudio: HTMLAudioElement,
    nextUrl: string,
    prepareNext: () => void,
    durationMs?: number,
  ): Promise<void>
  ```

- [ ] **Step 1: Write the failing test**

In `tests/unit/utils/audioEngine.spec.ts`, add test cases for `transitionAudioSource`:
```ts
	it("smoothly transitions audio source with micro-fadeout when audio is playing", async () => {
		const targetAudio = {
			paused: false,
			currentTime: 10,
			volume: 0.8,
			pause: vi.fn(() => {
				targetAudio.paused = true;
			}),
		} as unknown as HTMLAudioElement;

		let sourceChanged = false;
		await transitionAudioSource(targetAudio, "https://example.com/next.mp3", () => {
			sourceChanged = true;
		}, 30);

		expect(sourceChanged).toBe(true);
		expect(targetAudio.pause).toHaveBeenCalled();
	});

	it("immediately executes prepareNext without fade when audio is already paused", async () => {
		const targetAudio = {
			paused: true,
			currentTime: 0,
			volume: 0.8,
			pause: vi.fn(),
		} as unknown as HTMLAudioElement;

		let sourceChanged = false;
		await transitionAudioSource(targetAudio, "https://example.com/next.mp3", () => {
			sourceChanged = true;
		}, 30);

		expect(sourceChanged).toBe(true);
		expect(targetAudio.pause).not.toHaveBeenCalled();
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/utils/audioEngine.spec.ts`
Expected: FAIL with `transitionAudioSource is not defined`.

- [ ] **Step 3: Implement `transitionAudioSource` in `src/utils/audioEngine.ts`**

Export `transitionAudioSource` from `src/utils/audioEngine.ts`:
```ts
/**
 * Smoothly transitions an audio element to a new source by performing a micro fade-out
 * (30-40ms) to prevent digital DC-offset clicks/pops when swapping playback sources.
 * In paused state or test environment without playback, runs immediately.
 */
export async function transitionAudioSource(
	targetAudio: HTMLAudioElement,
	nextUrl: string,
	prepareNext: () => void,
	durationMs = 35,
): Promise<void> {
	if (!targetAudio || targetAudio.paused || targetAudio.currentTime <= 0) {
		prepareNext();
		return;
	}

	const originalVolume = targetAudio.volume;
	const steps = 3;
	const stepTime = Math.max(8, Math.floor(durationMs / steps));

	try {
		for (let i = 1; i <= steps; i++) {
			targetAudio.volume = Math.max(0, originalVolume * (1 - i / steps));
			await new Promise((resolve) => setTimeout(resolve, stepTime));
		}
		targetAudio.pause();
	} catch {
		// Ignore audio element errors during transition
	}

	prepareNext();
	targetAudio.volume = originalVolume;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/unit/utils/audioEngine.spec.ts`
Expected: PASS (9 tests passed).

- [ ] **Step 5: Commit**

```bash
git add src/utils/audioEngine.ts tests/unit/utils/audioEngine.spec.ts
git commit -m "feat(audio): add transitionAudioSource with micro-fadeout to eliminate DC-offset pops"
```

---

### Task 2: 播放器 Store 增加智能音量记忆与 Mute 控制，对接防爆音换源 (`src/stores/player.ts`)

**Files:**
- Modify: `src/stores/player.ts`
- Modify: `src/components/music/AudioPlayer.vue:192,363`
- Test: `tests/unit/stores/player.spec.ts`

**Interfaces:**
- Consumes: `transitionAudioSource` from `@/utils/audioEngine`
- Produces:
  - `playerStore.toggleMute(): void`
  - `playerStore.isMuted: ComputedRef<boolean>`
  - `playerStore.lastNonZeroVolume: Ref<number>`

- [ ] **Step 1: Write the failing test in `tests/unit/stores/player.spec.ts`**

Add tests for `toggleMute` and volume memory:
```ts
	it("remembers previous volume and restores it when toggling mute", () => {
		const store = usePlayerStore();
		store.setVolume(0.85);
		expect(store.volume).toBe(0.85);
		expect(store.isMuted).toBe(false);

		store.toggleMute();
		expect(store.volume).toBe(0);
		expect(store.isMuted).toBe(true);

		store.toggleMute();
		expect(store.volume).toBe(0.85);
		expect(store.isMuted).toBe(false);
	});

	it("falls back to 0.5 if volume was initially 0 when unmuting", () => {
		const store = usePlayerStore();
		store.setVolume(0);
		store.toggleMute();
		expect(store.volume).toBe(0.5);
		expect(store.isMuted).toBe(false);
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/stores/player.spec.ts`
Expected: FAIL (`store.toggleMute is not a function`).

- [ ] **Step 3: Implement `toggleMute`, `isMuted`, and integrate `transitionAudioSource`**

1. In `src/stores/player.ts`:
   - Import `transitionAudioSource` from `@/utils/audioEngine`.
   - Add state:
     ```ts
     const lastNonZeroVolume = ref(1.0);
     ```
   - Update `setVolume`:
     ```ts
     const setVolume = (v: number) => {
       const clamped = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
       if (clamped > 0) {
         lastNonZeroVolume.value = clamped;
       }
       volume.value = clamped;
       if (audio) {
         audio.volume = computeActualVolume(clamped);
       }
     };
     ```
   - Add `toggleMute`:
     ```ts
     const toggleMute = () => {
       if (volume.value > 0) {
         lastNonZeroVolume.value = volume.value;
         setVolume(0);
       } else {
         setVolume(lastNonZeroVolume.value > 0 ? lastNonZeroVolume.value : 0.5);
       }
     };
     const isMuted = computed(() => volume.value === 0);
     ```
   - In `startSong`, apply `transitionAudioSource`:
     ```ts
     const applySongSource = () => {
       player.src = normalizedSong.audio_url;
       isCurrentAudioCached.value = false;
       player.volume = computeActualVolume(volume.value);
     };
     if (!audio.paused && audio.currentTime > 0) {
       void transitionAudioSource(player, normalizedSong.audio_url, applySongSource);
     } else {
       applySongSource();
     }
     ```
   - Export `toggleMute`, `isMuted`, `lastNonZeroVolume` in return statement of `usePlayerStore`.

2. In `src/components/music/AudioPlayer.vue`:
   - Replace `@toggle-mute="player.setVolume(player.volume > 0 ? 0 : 0.5)"` (line 192) with `@toggle-mute="player.toggleMute()"`.
   - Replace `else if (shortcut === 'mute') player.setVolume(player.volume > 0 ? 0 : 0.5)` (line 363) with `else if (shortcut === 'mute') player.toggleMute()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:unit tests/unit/stores/player.spec.ts tests/unit/components/music/AudioPlayer.spec.ts`
Expected: PASS (all tests pass).

- [ ] **Step 5: Commit**

```bash
git add src/stores/player.ts src/components/music/AudioPlayer.vue tests/unit/stores/player.spec.ts
git commit -m "feat(player): add toggleMute with volume memory and integrate transitionAudioSource"
```

---

### Task 3: 播客领域逻辑适配器解耦 (`src/composables/usePodcastPlaybackAdapter.ts`)

**Files:**
- Create: `src/composables/usePodcastPlaybackAdapter.ts`
- Modify: `src/stores/player.ts`
- Test: `tests/unit/composables/usePodcastPlaybackAdapter.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export function usePodcastPlaybackAdapter(): {
    createPodcastSong: (feedItem: FeedItem) => Song;
    createPodcastEpisodeSong: (episode: PodcastEpisode) => Song;
    savePodcastProgress: (currentSong: Song | null, currentTime: number, duration: number) => void;
    readPodcastProgress: (episodeId: string) => PodcastProgressRecord | null;
    createEpisodeConsumptionTracker: (options: PodcastTrackerOptions) => PodcastTrackerInstance;
  }
  ```

- [ ] **Step 1: Write the failing test in `tests/unit/composables/usePodcastPlaybackAdapter.spec.ts`**

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { usePodcastPlaybackAdapter } from "@/composables/usePodcastPlaybackAdapter";
import type { PodcastEpisode } from "@/types";

describe("usePodcastPlaybackAdapter", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("converts a podcast episode into a playable Song format", () => {
		const adapter = usePodcastPlaybackAdapter();
		const episode: PodcastEpisode = {
			id: 101,
			title: "Episode 101",
			podcast_id: 1,
			podcast_title: "Tech Weekly",
			audio_url: "https://example.com/ep101.mp3",
			duration_seconds: 3600,
			cover_url: "https://example.com/cover.jpg",
			published_at: "2026-10-19T00:00:00Z",
		};

		const song = adapter.createPodcastEpisodeSong(episode);
		expect(song.id).toBe("podcast:101");
		expect(song.source_type).toBe("podcast_episode");
		expect(song.source_id).toBe("101");
		expect(song.title).toBe("Episode 101");
		expect(song.artist).toBe("Tech Weekly");
		expect(song.duration).toBe(3600);
	});

	it("reads and saves podcast progress to localStorage", () => {
		const adapter = usePodcastPlaybackAdapter();
		const song = adapter.createPodcastEpisodeSong({
			id: 202,
			title: "Episode 202",
			audio_url: "https://example.com/ep202.mp3",
		} as any);

		adapter.savePodcastProgress(song, 120, 300);
		const saved = adapter.readPodcastProgress("202");
		expect(saved?.position_sec).toBe(120);
		expect(saved?.completed).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/composables/usePodcastPlaybackAdapter.spec.ts`
Expected: FAIL (`Cannot find module '@/composables/usePodcastPlaybackAdapter'`).

- [ ] **Step 3: Implement `usePodcastPlaybackAdapter.ts` and delegate in `player.ts`**

1. Create `src/composables/usePodcastPlaybackAdapter.ts`:
   - Move `createPodcastSong`, `createPodcastEpisodeSong`, `savePodcastProgress`, `readPodcastProgress` from `src/stores/player.ts`.
   - Export helper functions and composable.
2. In `src/stores/player.ts`:
   - Import `usePodcastPlaybackAdapter` from `@/composables/usePodcastPlaybackAdapter`.
   - Instantiate adapter and delegate `savePodcastProgress`, `readPodcastProgress`, `createPodcastSong`, `createPodcastEpisodeSong`.
   - Keep exported method signatures on `usePlayerStore()` for 100% backward compatibility.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:unit tests/unit/composables/usePodcastPlaybackAdapter.spec.ts tests/unit/stores/player.spec.ts tests/unit/components/music/AudioPlayer.spec.ts`
Expected: PASS (all tests pass).

- [ ] **Step 5: Commit**

```bash
git add src/composables/usePodcastPlaybackAdapter.ts src/stores/player.ts tests/unit/composables/usePodcastPlaybackAdapter.spec.ts
git commit -m "refactor(podcast): decouple podcast playback adapter from player store"
```

---

### Task 4: 播放器全套组件 0 阴影净化与样式规范对齐

**Files:**
- Modify: `src/components/music/AudioPlayerVolume.vue:77,186,194,203,211`
- Modify: `src/components/music/AudioPlayerMini.vue:83`
- Modify: `src/components/music/AudioPlayerQueue.vue:317,560`
- Modify: `src/components/music/AudioPlayer.vue:573,785,878,1035,1135,1143,1152,1160,1227,1553`
- Test: `tests/unit/components/music/AudioPlayer.spec.ts`
- Test: `tests/unit/components/music/AudioPlayerVolume.spec.ts`
- Test: `tests/unit/components/music/AudioPlayerMini.spec.ts`

- [ ] **Step 1: Check existing box-shadow occurrences**

Run: `git grep "box-shadow" src/components/music/AudioPlayer*`
Confirm exact line numbers and occurrences.

- [ ] **Step 2: Remove `box-shadow` and align with 1px border hairline and 4px radius**

1. In `src/components/music/AudioPlayerVolume.vue`:
   - Line 77: Remove `box-shadow: var(--a-shadow-dropdown, var(--a-shadow-lg));` -> `box-shadow: none;`
   - Lines 186 & 203: Remove `box-shadow: var(--a-shadow-sm);` -> `box-shadow: none;`
   - Lines 194 & 211: Change focus/hover ring from `box-shadow: 0 0 0 3px ...` to `outline: 2px solid var(--a-color-primary); outline-offset: 1px; box-shadow: none;`
2. In `src/components/music/AudioPlayerMini.vue`:
   - Line 83: Remove `box-shadow: var(--a-shadow-dropdown, 0 4px 16px -2px rgba(15, 23, 42, 0.08));` -> `box-shadow: none;`
3. In `src/components/music/AudioPlayerQueue.vue`:
   - Line 317: Replace `box-shadow: var(--a-shadow-lg);` with `box-shadow: none;`
   - Line 560: Replace `box-shadow: 0 0 0 1px var(--a-color-primary);` with `outline: 1px solid var(--a-color-primary); box-shadow: none;`
4. In `src/components/music/AudioPlayer.vue`:
   - Remove lingering `box-shadow` rules across lines 573, 785, 878, 1035, 1135, 1143, 1152, 1160, 1227, 1553 without modifying the CSS selectors required by `AudioPlayer.spec.ts`.

- [ ] **Step 3: Run test suites to ensure zero visual contract regressions**

Run:
```bash
bun run test:unit tests/unit/components/music/AudioPlayer.spec.ts tests/unit/components/music/AudioPlayerVolume.spec.ts tests/unit/components/music/AudioPlayerMini.spec.ts tests/unit/components/music/AudioPlayerQueue.spec.ts
```
Expected: PASS (all 29 tests pass).

- [ ] **Step 4: Verify 0 shadow in player components**

Run:
```bash
git grep "box-shadow" src/components/music/AudioPlayer*
```
Expected: Only `box-shadow: none;` or 0 occurrences.

- [ ] **Step 5: Commit**

```bash
git add src/components/music/AudioPlayerVolume.vue src/components/music/AudioPlayerMini.vue src/components/music/AudioPlayerQueue.vue src/components/music/AudioPlayer.vue
git commit -m "style(player): eliminate box-shadow rules and align with strict paper design system"
```

---

### Task 5: 全量类型检查、跨模块单元测试与构建验证

**Files:**
- Test: All unit test suites

- [ ] **Step 1: Run TypeScript type check**

Run: `bun run type-check`
Expected: 0 errors.

- [ ] **Step 2: Run all player and music-related test suites**

Run:
```bash
bun run test:unit tests/unit/stores/player.spec.ts tests/unit/utils/audioEngine.spec.ts tests/unit/components/music/ tests/unit/views/music/ tests/unit/views/podcast/
```
Expected: 100% passing tests.

- [ ] **Step 3: Run production build**

Run: `bun run build`
Expected: Build successfully completes with exit code 0.

- [ ] **Step 4: Commit any final chore adjustments if needed**

```bash
git commit --allow-empty -m "chore(player): complete music player audio engine and ui refactoring verification"
```
