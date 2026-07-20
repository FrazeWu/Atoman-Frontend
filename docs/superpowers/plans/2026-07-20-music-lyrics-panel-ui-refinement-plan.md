# MusicLyricsPanel UI Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the MusicLyricsPanel and related components to implement an adaptive glassmorphism bottom sheet, left-aligned layout with monospace timeline indicators, high-contrast active lines with faded inactive ones, and paper-styled border elements for annotations.

**Architecture:** Modifying templates and styles in `src/components/music/MusicLyricsPanel.vue`, `src/components/music/MusicLyricsLine.vue`, `src/components/music/MusicAnnotationPanel.vue`, and `src/components/music/MusicAnnotationEditor.vue`, and verifying via component test suites.

**Tech Stack:** Vue 3, Tailwind CSS v4, Vitest.

---

### Task 1: Refine MusicLyricsPanel Slide-Up Container & Header

**Files:**
- Modify: `src/components/music/MusicLyricsPanel.vue`
- Test: `tests/unit/components/music/MusicLyricsPanel.spec.ts`

- [ ] **Step 1: Write assertions in tests/unit/components/music/MusicLyricsPanel.spec.ts**

Ensure tests assert the existence of `.music-lyrics-panel` container and its corresponding classes.

- [ ] **Step 2: Run tests to verify setup**

Run: `bun run test:unit tests/unit/components/music/MusicLyricsPanel.spec.ts`

- [ ] **Step 3: Modify main container CSS styles in MusicLyricsPanel.vue**

Replace class `.music-lyrics-panel` styles to implement adaptive glassmorphism and remove shadows:
```css
.music-lyrics-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1.5rem 1.5rem 2rem;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--a-color-border-soft);
  box-shadow: none;
}

@media (prefers-color-scheme: dark) {
  .music-lyrics-panel {
    background: rgba(15, 23, 42, 0.88);
    border-top: 1px solid var(--a-color-border-dark, #334155);
  }
}
:root[data-theme='dark'] .music-lyrics-panel {
  background: rgba(15, 23, 42, 0.88);
  border-top: 1px solid var(--a-color-border-dark, #334155);
}
```

- [ ] **Step 4: Refine header buttons and action buttons**

Change `.music-lyrics-panel__close` and header buttons to standardize roundness (`border-radius: 4px`) and visual flat paper style.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test:unit tests/unit/components/music/MusicLyricsPanel.spec.ts`

- [ ] **Step 6: Commit**

```bash
git commit -am "style: implement adaptive glassmorphism and flat header actions for lyrics panel"
```

---

### Task 2: Refine MusicLyricsLine Timeline & Typography

**Files:**
- Modify: `src/components/music/MusicLyricsLine.vue`
- Test: `tests/unit/components/music/MusicLyricsLine.spec.ts` (if exists, or add spec checks)

- [ ] **Step 1: Write assertions in tests**

Assert that active/inactive lines have correct opacity values and left-aligned grid layouts.

- [ ] **Step 2: Update MusicLyricsLine.vue Template & Styling**

Modify `src/components/music/MusicLyricsLine.vue` to align left and support monospace timeline metadata:
1. Ensure the timeline indicator timestamp is left-aligned and styled as:
```css
.lyric-line__time {
  font-family: var(--a-font-mono, monospace);
  font-size: 11px;
  color: var(--a-color-muted);
  width: 42px;
  flex-shrink: 0;
  text-align: left;
}
```
2. Update `.lyric-line` container styles:
```css
.lyric-line {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  text-align: left;
  opacity: 0.3; /* Inactive lines fade */
  transition: opacity 0.25s ease, font-weight 0.2s;
}

.lyric-line.is-active {
  opacity: 1; /* Active lines high contrast */
  font-weight: 500;
  color: var(--a-color-text);
}
```

- [ ] **Step 3: Run tests to verify all tests pass**

Run: `bun run test:unit tests/unit/components/music/MusicLyricsLine.spec.ts` (or run relevant music suite tests)

- [ ] **Step 4: Commit**

```bash
git commit -am "style: make lyrics lines left-aligned with monospace timelines and active/inactive opacity contrast"
```

---

### Task 3: Refine MusicAnnotationPanel & MusicAnnotationEditor

**Files:**
- Modify: `src/components/music/MusicAnnotationPanel.vue`
- Modify: `src/components/music/MusicAnnotationEditor.vue`

- [ ] **Step 1: Modify Annotation Panel styles**

Update `.annotation-card` styles in `src/components/music/MusicAnnotationPanel.vue` to remove shadows and implement flat paper styling:
```css
.annotation-card {
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-surface);
  box-shadow: none; /* No shadow */
  padding: 12px;
  transition: border-color 0.2s;
}

.annotation-card:hover {
  border-color: var(--a-color-muted-soft);
}
```

- [ ] **Step 2: Modify Annotation Editor styles**

Update `.annotation-editor` form inputs and container in `src/components/music/MusicAnnotationEditor.vue` to use 4px square border-radius, clean inputs, and remove shadow overlays.

- [ ] **Step 3: Run unit tests to check functionality**

Run: `bun run test:unit tests/unit/components/music/MusicAnnotationPanel.spec.ts`

- [ ] **Step 4: Commit**

```bash
git commit -am "style: paperize annotation panel and editor cards"
```

---

### Task 4: Complete Final Verification

- [ ] **Step 1: Run entire music unit test suite to verify no regressions**

Run: `bun run test:unit tests/unit/components/music/AudioPlayer.spec.ts && bun run test:unit tests/unit/components/music/MusicLyricsPanel.spec.ts`

- [ ] **Step 2: Commit and mark task completed**
