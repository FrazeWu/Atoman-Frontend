# Theme Background Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the layout theme issues in Atoman-Frontend where components render with dark backgrounds under prefers-color-scheme: dark. Align all dark theme overrides to exclusively target `:root.dark`.

**Architecture:** Replace system media query overrides and attribute-based theme selectors in the styling of music components with class-based selectors scoped to `:root.dark`.

**Tech Stack:** Vue 3, Tailwind CSS v4, Vanilla CSS.

---

### Task 1: Fix Theme Selectors in Drawers

**Files:**
- Modify: [ArtistDrawer.vue](file:///root/Atoman/Atoman-Frontend/src/components/music/ArtistDrawer.vue) (lines 302-312)
- Modify: [MusicLyricEditorDrawer.vue](file:///root/Atoman/Atoman-Frontend/src/components/music/MusicLyricEditorDrawer.vue) (lines 622-631)
- Modify: [MusicEntityEditorDrawer.vue](file:///root/Atoman/Atoman-Frontend/src/components/music/MusicEntityEditorDrawer.vue) (lines 623-632)

- [ ] **Step 1: Simplify ArtistDrawer.vue theme selectors**
  Remove `@media (prefers-color-scheme: dark)` block and merge styles into a single `:global(:root.dark .artist-drawer)` block:
  ```css
  :global(:root.dark .artist-drawer) {
    background: rgba(15, 23, 42, 0.88) !important;
    border-left: 1px solid var(--a-color-border-dark, #334155) !important;
  }
  ```

- [ ] **Step 2: Simplify MusicLyricEditorDrawer.vue theme selectors**
  Remove `@media (prefers-color-scheme: dark)` block and merge styles into a single `:root.dark :global(.lyric-editor-drawer)` block:
  ```css
  :root.dark :global(.lyric-editor-drawer) {
    background: rgba(15, 23, 42, 0.88) !important;
    border-left: 1px solid var(--a-color-border-dark, #334155) !important;
  }
  ```

- [ ] **Step 3: Simplify MusicEntityEditorDrawer.vue theme selectors**
  Remove `@media (prefers-color-scheme: dark)` block and merge styles into a single `:root.dark :global(.entity-editor-drawer)` block:
  ```css
  :root.dark :global(.entity-editor-drawer) {
    background: rgba(15, 23, 42, 0.88) !important;
    border-left: 1px solid var(--a-color-border-dark, #334155) !important;
  }
  ```

- [ ] **Step 4: Commit Drawer changes**
  ```bash
  git add src/components/music/ArtistDrawer.vue src/components/music/MusicLyricEditorDrawer.vue src/components/music/MusicEntityEditorDrawer.vue
  git commit -m "style: simplify theme selectors for music drawers to root.dark"
  ```

---

### Task 2: Fix Theme Selectors in MusicLyricsPanel.vue

**Files:**
- Modify: [MusicLyricsPanel.vue](file:///root/Atoman/Atoman-Frontend/src/components/music/MusicLyricsPanel.vue) (lines 628-638)

- [ ] **Step 1: Simplify theme selectors in style block**
  Remove prefers-color-scheme media query and use `:root.dark .music-lyrics-panel` instead of the data-theme attribute selector:
  ```css
  :root.dark .music-lyrics-panel {
    background: rgba(15, 23, 42, 0.88);
    border-top: 1px solid var(--a-color-border-dark, #334155);
  }
  ```

- [ ] **Step 2: Commit MusicLyricsPanel changes**
  ```bash
  git add src/components/music/MusicLyricsPanel.vue
  git commit -m "style: restrict music lyrics panel dark styling to root.dark"
  ```

---

### Task 3: Fix Theme Selectors in AudioPlayer.vue

**Files:**
- Modify: [AudioPlayer.vue](file:///root/Atoman/Atoman-Frontend/src/components/music/AudioPlayer.vue) (lines 538-552, 773-785, 944-953, 1010-1017)

- [ ] **Step 1: Update player container selectors**
  Replace `.player` dark styles with:
  ```css
  :root.dark .player {
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid var(--a-color-border-dark, #334155);
  }
  ```

- [ ] **Step 2: Update main play button selectors**
  Replace `.main-play-btn` dark styles with:
  ```css
  :root.dark .main-play-btn {
    background: #ffffff;
    color: #0f172a;
    border-color: #ffffff;
  }
  ```

- [ ] **Step 3: Update volume control selectors**
  Replace `.volume-control` dark styles with:
  ```css
  :root.dark .volume-control {
    background: rgba(15, 23, 42, 0.88);
    border-color: var(--a-color-border-dark, #334155);
  }
  ```

- [ ] **Step 4: Update queue trigger selectors**
  Replace `.queue-trigger` dark styles with:
  ```css
  :root.dark .queue-trigger {
    background: rgba(255, 255, 255, 0.1);
  }
  ```

- [ ] **Step 5: Commit AudioPlayer changes**
  ```bash
  git add src/components/music/AudioPlayer.vue
  git commit -m "style: simplify AudioPlayer theme selectors to root.dark"
  ```

---

### Task 4: Build Verification & Testing

- [ ] **Step 1: Run type checking**
  Run: `bun run type-check`
  Expected: PASS

- [ ] **Step 2: Run frontend build check**
  Run: `bun run build`
  Expected: Success without errors.
