# Mobile Player Gestures & Immersive Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement fluid physical gestures for the mobile player (pull-down-to-dismiss with spring rebound, horizontal swipe-to-skip on album/lyrics stage, micro-displacement drag-to-expand on MiniPlayer) and eliminate viewport layout jitter during fullscreen transitions.

**Architecture:** Touch events are tracked with interactive element exclusions and physical logarithmic damping. Visual transforms follow finger position smoothly, and release velocities/thresholds determine whether to commit dismiss/expand or snap back with cubic-bezier springs. Fullscreen player overlays the viewport cleanly to shield background nav changes.

**Tech Stack:** Vue 3.4, TypeScript 5.8, Pinia, Vitest, Vue Test Utils.

## Global Constraints
- Zero shadow: `box-shadow: none !important;` across all elements.
- 4px border radius: `var(--a-radius-control, 4px)`.
- Full tokenization: No hardcoded arbitrary colors; use semantic CSS tokens (`--a-color-bg`, `--a-color-border-soft`, etc.).
- No fake/mock data in production code: use real store state (`usePlayerStore`).
- Codebase consistency: maintain existing interfaces and route capabilities (`/music/player`).

---

### Task 1: MobilePlayerView 下拉收起手势 (Pull-to-Dismiss) 与回弹判定

**Files:**
- Create: `Atoman-Frontend/tests/unit/mobile/MobilePlayerGestures.spec.ts`
- Modify: `Atoman-Frontend/apps/mobile/MobilePlayerView.vue`

**Interfaces:**
- Consumes: `usePlayerStore()`, `router.back()`, `router.push('/music')`
- Produces: Downward drag gestures on header/cover with physical displacement, snap-back animation, and dismiss execution on threshold/flick.

- [ ] **Step 1: Write the failing unit tests for Pull-to-Dismiss**
  Create `tests/unit/mobile/MobilePlayerGestures.spec.ts` testing:
  1. Downward touch drag updates the root container transform `translateY(...)`.
  2. Pulling down beyond threshold (>72px) and releasing triggers `handleDismiss` (calls router back or push).
  3. Pulling down under threshold (<72px) and releasing snaps container transform back to 0 without dismissing.
  4. Touches on interactive elements (buttons, sliders, links) do not initiate dragging.

- [ ] **Step 2: Run tests to verify failure**
  Run `cd Atoman-Frontend && bun test tests/unit/mobile/MobilePlayerGestures.spec.ts` and confirm failure.

- [ ] **Step 3: Implement Pull-to-Dismiss gesture in MobilePlayerView.vue**
  - Add gesture state: `dragOffsetY = ref(0)`, `isDragging = ref(false)`, `isDismissing = ref(false)`.
  - Add interactive element filter: ignore touches targeting buttons, inputs, slider thumbs, or actions.
  - Implement touchmove with damping: `dragOffsetY.value = Math.max(0, currentY - startY)`. If `dragOffsetY > 120`, apply logarithmic damping factor.
  - Implement touchend: if `dragOffsetY > 72` or downward velocity > 0.4, trigger dismiss transition and invoke `handleDismiss()`; otherwise smoothly snap back to 0.
  - Bind `:style="containerDragStyle"` on `.mobile-player-view`.

- [ ] **Step 4: Run tests to verify passing**
  Run `cd Atoman-Frontend && bun test tests/unit/mobile/MobilePlayerGestures.spec.ts` and ensure all tests pass.

- [ ] **Step 5: Commit changes**
  Commit Task 1 changes with git commit message `feat(mobile): add pull-to-dismiss gesture to mobile player`.

---

### Task 2: MobilePlayerView 舞台区水平轻扫切歌 (Swipe-to-Skip)

**Files:**
- Modify: `Atoman-Frontend/apps/mobile/MobilePlayerView.vue`
- Modify: `Atoman-Frontend/tests/unit/mobile/MobilePlayerGestures.spec.ts`

**Interfaces:**
- Consumes: `player.playNext()`, `player.playPrevious()`
- Produces: Left/right swipe detection on cover art & inline lyrics stage.

- [ ] **Step 1: Add failing tests for Swipe-to-Skip in MobilePlayerGestures.spec.ts**
  Add unit tests verifying:
  1. Swiping left on cover art (deltaX < -50, horizontal dominance) triggers `player.playNext()`.
  2. Swiping right on cover art (deltaX > 50, horizontal dominance) triggers `player.playPrevious()`.
  3. Swiping on lyrics container when not scrolling also triggers track skip.

- [ ] **Step 2: Run tests to verify failure**
  Run `cd Atoman-Frontend && bun test tests/unit/mobile/MobilePlayerGestures.spec.ts` and confirm new tests fail.

- [ ] **Step 3: Implement Swipe-to-Skip in MobilePlayerView.vue**
  - In touch tracking, evaluate horizontal delta when touch ends.
  - If `Math.abs(deltaX) > 50` and `Math.abs(deltaX) > 1.2 * Math.abs(deltaY)`, dispatch `playNext()` or `playPrevious()`.
  - Ensure horizontal swipes do not trigger pull-down dismiss or conflict with lyrics vertical scrolling.

- [ ] **Step 4: Run tests to verify passing**
  Run `cd Atoman-Frontend && bun test tests/unit/mobile/MobilePlayerGestures.spec.ts`.

- [ ] **Step 5: Commit changes**
  Commit Task 2 changes with git commit message `feat(mobile): add swipe-to-skip track gesture on player stage`.

---

### Task 3: MobileAudioPlayer (MiniPlayer) 向上跟手微动与顺畅展开

**Files:**
- Create: `Atoman-Frontend/tests/unit/mobile/MobileMiniPlayerGestures.spec.ts`
- Modify: `Atoman-Frontend/apps/mobile/MobileAudioPlayer.vue`

**Interfaces:**
- Consumes: `openPlayer()`, `player.playNext()`, `player.playPrevious()`
- Produces: Physical micro-displacement on drag up, smooth snap back or expansion.

- [ ] **Step 1: Write failing unit test for MiniPlayer drag-to-expand**
  Create `tests/unit/mobile/MobileMiniPlayerGestures.spec.ts` testing:
  1. Dragging upward produces upward displacement `translateY(...)`.
  2. Releasing after upward drag > 40px calls `openPlayer()`.
  3. Releasing below 40px snaps back to 0.

- [ ] **Step 2: Run tests to verify failure**
  Run `cd Atoman-Frontend && bun test tests/unit/mobile/MobileMiniPlayerGestures.spec.ts` and verify failure.

- [ ] **Step 3: Implement drag-up micro-displacement in MobileAudioPlayer.vue**
  - Add reactive `dragOffsetY = ref(0)` and `isDragging = ref(false)`.
  - In `handleTouchMove`, calculate upward shift: `dragOffsetY.value = Math.min(0, Math.max(-20, deltaY * 0.35))`.
  - Bind `:style="miniPlayerDragStyle"` with spring transition when not dragging.
  - On touchend, if `deltaY < -40`, trigger `openPlayer()`; otherwise reset `dragOffsetY` to 0.

- [ ] **Step 4: Run tests to verify passing**
  Run `cd Atoman-Frontend && bun test tests/unit/mobile/MobileMiniPlayerGestures.spec.ts`.

- [ ] **Step 5: Commit changes**
  Commit Task 3 with git commit message `feat(mobile): add drag-up micro-displacement to mini player`.

---

### Task 4: 全屏播放器路由层级与视口防抖优化

**Files:**
- Modify: `Atoman-Frontend/apps/mobile/MobilePlayerView.vue`
- Modify: `Atoman-Frontend/apps/mobile/MobileApp.vue`
- Modify: `Atoman-Frontend/tests/unit/mobile/MobilePlayerView.spec.ts`

**Interfaces:**
- Consumes: `isFullscreenPlayerRoute`, `mobileRouteTransition`
- Produces: Jitter-free transition when entering/exiting player, full viewport coverage.

- [ ] **Step 1: Inspect and update MobilePlayerView styling for viewport coverage**
  - Ensure `.mobile-player-view` uses `position: fixed; inset: 0; z-index: var(--a-z-modal, 800); height: 100dvh; background: var(--a-color-bg, #ffffff); overflow-y: auto;`
  - Ensure it shields background bottom navigation and content from resizing/jumping while transition is active.

- [ ] **Step 2: Verify existing player view tests and update as needed**
  Run `cd Atoman-Frontend && bun test tests/unit/mobile/MobilePlayerView.spec.ts`.

- [ ] **Step 3: Run full type-check and mobile tests**
  Run `cd Atoman-Frontend && bun run type-check` and `cd Atoman-Frontend && bun test tests/unit/mobile/`.

- [ ] **Step 4: Commit changes**
  Commit Task 4 with git commit message `fix(mobile): stabilize fullscreen player viewport and layer transition`.
