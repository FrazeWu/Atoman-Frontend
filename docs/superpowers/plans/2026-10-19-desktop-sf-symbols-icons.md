# Implementation Plan: Desktop Apple SF Symbols Icon System Upgrade

**Goal**: Bring the Apple SF Symbols geometric stroke icon system from mobile to desktop, establishing a unified desktop icon primitive `PIcon.vue` and upgrading high-visibility surfaces (Global Topbar, Global Music Player Bar, and Core Interaction Buttons).

**Architecture**:
- Framework: Vue 3.4 + TypeScript
- Style: Pure-White Minimal Design System (1.6px stroke, geometric stroke paths, round caps/joins)
- Placement: `src/components/ui/PIcon.vue`

---

## Tasks

### Task 1: Desktop Icon Primitive `PIcon.vue` & SF Symbols Registry
- **Files**:
  - `src/components/ui/PIcon.vue`
  - `tests/unit/ui/PIcon.spec.ts`
- **Details**:
  - Pure SVG vector renderer, default `strokeWidth: 1.6`, `stroke-linecap="round"`, `stroke-linejoin="round"`.
  - Size variants: `xs` (12px), `sm` (14px), `md` (16px), `lg` (20px), `xl` (24px).
  - Rich icon registry covering media controls, navigation, status, actions, and spaces.
  - TDD: write failing unit tests in `tests/unit/ui/PIcon.spec.ts`, implement component, pass tests.

### Task 2: Desktop Global Topbar & Header Chrome Modernization
- **Files**:
  - `src/components/system/AppTopbar.vue`
  - `src/components/system/AppTopbarAuthControls.vue`
  - `src/components/system/AppTopbarGlobalSearch.vue`
  - `src/components/system/NotificationPopover.vue`
- **Details**:
  - Replace Lucide icons (`Menu`, `ArrowLeft`, `Sun`, `Moon`, `Search`, `Bell`, `MessageSquare`, `Trash`, `Check`) with `PIcon`.
  - Ensure zero layout shifts or accessibility label regressions.
  - Test with existing topbar unit tests.

### Task 3: Desktop Persistent Music Player Bar Modernization
- **Files**:
  - `src/components/music/AudioPlayer.vue`
  - `src/components/music/AudioPlayerMini.vue`
  - `src/components/music/AudioPlayerQueue.vue`
- **Details**:
  - Upgrade player controls (`play`, `pause`, `player-prev`, `player-next`, `shuffle`, `repeat`, `queue`, `file-text`/lyrics, `volume`, `heart`).
  - Normalize stroke and active states.
  - Verify all audio player unit tests pass (`tests/unit/components/music/`).

### Task 4: Content Interaction Buttons (`PLikeButton` & `PBookmarkButton`)
- **Files**:
  - `src/components/ui/PLikeButton.vue`
  - `src/components/ui/PBookmarkButton.vue`
- **Details**:
  - Replace Lucide `Heart`, `ThumbsUp`, `Bookmark` with `PIcon`.
  - Maintain active bounce/pop animations and `.is-filled` styling.
  - Verify existing unit tests pass.

### Task 5: Whole-Branch Verification & Build
- Verify 100% passing tests (`bun run test:unit`).
- Verify clean type-check (`bun run type-check`).
- Verify production desktop build (`bun run build`).
