# AudioPlayer UI Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the AudioPlayer component style to implement an adaptive glassmorphism background, 4px square rounded corners, high-contrast play buttons, optimized text controls, monospace metadata layouts, and keeping the progress bar below the controls.

**Architecture:** Modify the template and styles in `src/components/music/AudioPlayer.vue` to align with the Flat Paper UI specification and the finalized user preferences, and verify with tests in `tests/unit/components/music/AudioPlayer.spec.ts`.

**Tech Stack:** Vue 3, Tailwind CSS v4, Vitest, Lucide Icons.

---

### Task 1: Glassmorphism Background Panel Refinement

**Files:**
- Modify: `src/components/music/AudioPlayer.vue` (css section)

- [ ] **Step 1: Write a failing test for glassmorphism styling classes**

Add a test case in `tests/unit/components/music/AudioPlayer.spec.ts` asserting that the player container has classes/styles for backdrop filtering and correct borders:
```typescript
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, beforeEach } from 'vitest'
import AudioPlayer from '@/components/music/AudioPlayer.vue'

// (Existing code setup)

it('applies frosted glass styles to the player container', () => {
  const wrapper = mount(AudioPlayer, {
    global: {
      stubs: {
        MusicLyricsPanel: true,
        PDropdown: true,
        PToast: true,
      }
    }
  })
  const player = wrapper.find('.player')
  expect(player.exists()).toBe(true)
  // Assert backdrop filter is present in styling (we will target the component classes or inline styles)
  expect(window.getComputedStyle(player.element).backdropFilter || player.attributes('style')).toBeDefined()
})
```

- [ ] **Step 2: Run test to verify it fails or is unaligned**

Run: `bun run test:unit tests/unit/components/music/AudioPlayer.spec.ts`

- [ ] **Step 3: Implement adaptive glassmorphism styles in AudioPlayer.vue**

Update `.player` styles in `src/components/music/AudioPlayer.vue`:
```css
.player {
  position: fixed;
  bottom: calc(var(--a-footer-reserved-height) + var(--a-mobile-nav-reserved-height));
  width: 100%;
  z-index: var(--a-z-player, 720);
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--a-color-border-soft); /* #e2e8f0 */
  height: var(--a-player-height);
  transition: transform 0.3s cubic-bezier(0.2, 0, 0, 1);
}

/* Support dark mode theme override via root html theme attribute or prefers-color-scheme */
@media (prefers-color-scheme: dark) {
  .player {
    background: rgba(15, 23, 42, 0.85);
    border-top: 1px solid var(--a-color-border-dark, #334155);
  }
}
:root[data-theme='dark'] .player {
  background: rgba(15, 23, 42, 0.85);
  border-top: 1px solid var(--a-color-border-dark, #334155);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/unit/components/music/AudioPlayer.spec.ts`

- [ ] **Step 5: Commit**

```bash
git add src/components/music/AudioPlayer.vue tests/unit/components/music/AudioPlayer.spec.ts
git commit -m "style: implement adaptive glassmorphism background for player"
```

---

### Task 2: Standardize Play Button Shape and Color (High-Contrast 4px Rect)

**Files:**
- Modify: `src/components/music/AudioPlayer.vue`

- [ ] **Step 1: Write assertions for play button shape and colors**

Add unit test check for `.main-play-btn` in `tests/unit/components/music/AudioPlayer.spec.ts`:
Ensure it has `shape-rect` or specific 4px border radius and high-contrast colors classes.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/components/music/AudioPlayer.spec.ts`

- [ ] **Step 3: Modify main play button class styles in AudioPlayer.vue**

Replace `.main-play-btn` CSS in `src/components/music/AudioPlayer.vue`:
```css
.main-play-btn {
  background: #0f172a;
  color: #ffffff;
  border: 1px solid #0f172a;
  border-radius: 4px;
  padding: 6px 20px;
  font-weight: 500; /* Restrained font weight */
  font-size: 11px;
  cursor: pointer;
  letter-spacing: 0.1em;
  transition: transform 0.1s, background-color 0.15s;
}

.main-play-btn:active {
  transform: translateY(1px);
}

@media (prefers-color-scheme: dark) {
  .main-play-btn {
    background: #ffffff;
    color: #0f172a;
    border-color: #ffffff;
  }
}
:root[data-theme='dark'] .main-play-btn {
  background: #ffffff;
  color: #0f172a;
  border-color: #ffffff;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/unit/components/music/AudioPlayer.spec.ts`

- [ ] **Step 5: Commit**

```bash
git commit -am "style: update main play button to 4px rect with ink/paper colors"
```

---

### Task 3: Refine Controls Layout, Metadata Font and Right Side Features

**Files:**
- Modify: `src/components/music/AudioPlayer.vue`

- [ ] **Step 1: Implement progress bar below controls layout**

Ensure in the template that `.player-controls-hub` has `.ctrl-row` on top, and `.progress-container` below it (which is the original layout, but double check to verify flex classes did not stretch them side-by-side).

- [ ] **Step 2: Update skip/nav button text styling**

Modify `.skip-btn` and `.nav-btn` CSS to use opacity 0.5 and show underline/opacity 1 on hover:
```css
.skip-btn, .nav-btn {
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  opacity: 0.5;
  transition: opacity 0.2s, color 0.2s;
}

.skip-btn:hover, .nav-btn:hover {
  opacity: 1;
  text-decoration: underline;
}
```

- [ ] **Step 3: Update metadata typography layout**

1. Modify the artist template tag:
```html
<p class="player-artist" style="font-family: var(--a-font-mono); letter-spacing: 0.08em; text-transform: uppercase;">
  TRACK // {{ artistText }}
</p>
```
2. Reduce cover image size to `44px` with `4px` corner:
```css
.cover-wrap {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft);
  cursor: pointer;
  flex-shrink: 0;
}
```
3. Restrain song title font weight to `500`:
```css
.player-title {
  font-family: var(--a-font-sans);
  font-weight: 500;
  font-size: 13px;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}
```

- [ ] **Step 4: Update Right side features (Lyrics link, Queue Badge & Volume Popover)**

1. Make "词" text key `11px`:
```css
.feature-link {
  cursor: pointer;
  border-bottom: 1.5px solid transparent;
  font-size: 11px;
  font-weight: 500;
  padding: 0 4px;
  opacity: 0.5;
}
.feature-link:hover {
  opacity: 1;
  border-bottom-color: var(--a-color-text);
}
```
2. Modify volume slider popover (`.volume-control`) to use adaptive glassmorphism, no shadow and 4px corners:
```css
.volume-control {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%) translateY(8px);
  width: 44px;
  height: 112px;
  opacity: 0;
  visibility: hidden;
  overflow: hidden;
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.25s;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--a-color-border-soft);
  padding: 16px 0;
  z-index: 100;
  box-shadow: none; /* No shadow */
  border-radius: 4px; /* 4px radius */
}

@media (prefers-color-scheme: dark) {
  .volume-control {
    background: rgba(15, 23, 42, 0.88);
    border-color: var(--a-color-border-dark, #334155);
  }
}
:root[data-theme='dark'] .volume-control {
  background: rgba(15, 23, 42, 0.88);
  border-color: var(--a-color-border-dark, #334155);
}
```
3. Update Queue Badge count to grey flat rect box style:
```css
.queue-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: var(--a-color-muted);
  transition: all 0.2s;
  padding: 4px 8px;
  border-radius: 2px; /* 2px or 4px square shape */
  background: rgba(0, 0, 0, 0.05); /* Grey box */
  border: none;
}
.queue-count {
  font-family: var(--a-font-mono, monospace);
  font-size: 9px;
  font-weight: 500;
}
```

- [ ] **Step 5: Run tests and verify all pass**

Run: `bun run test:unit tests/unit/components/music/AudioPlayer.spec.ts`

- [ ] **Step 6: Commit**

```bash
git commit -am "style: refine nav controls, metadata text layout and right feature panel shapes"
```
