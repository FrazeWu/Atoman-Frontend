# 播放历史与收藏列表 UI 优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the styles of `HistoryView.vue` (cover geometry, metadata monospace columns) and `StarredView.vue` (custom result card flat lines, shadow removal, and tactile hover feedback) to keep them aligned with the Flat Paper visual guidelines.

**Tech Stack:** Vue 3, Tailwind CSS v4, Vitest.

---

### Task 1: Refine HistoryView Song Rows & Metadata

**Files:**
- Modify: `src/views/music/HistoryView.vue`
- Test: `tests/unit/views/music/MusicHistoryView.spec.ts` (if exists, or relevant suite tests)

- [ ] **Step 1: Update HistoryView styles**

Modify the `.history-cover` and layout classes in `src/views/music/HistoryView.vue`:
1. Enforce flat border and 4px corners on covers:
```css
.history-cover {
  position: relative;
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-surface-muted);
}
```
2. Refine duration and timestamp columns to match the tabular monospace standard:
```css
.history-count,
.history-time {
  font-family: monospace;
  font-size: 11px;
  color: var(--a-color-muted);
  white-space: nowrap;
}
```

- [ ] **Step 2: Verify changes locally**

Run history view tests or ensure it builds correctly.

---

### Task 2: Refine StarredView Custom Playlist Cards

**Files:**
- Modify: `src/views/music/StarredView.vue`

- [ ] **Step 1: Update result-card styles**

Modify `.result-card` styling in `src/views/music/StarredView.vue` to remove shadows and implement flat paper style and press hover effects:
```css
.result-card {
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-surface);
  box-shadow: none; /* No shadow */
  transition: border-color 0.2s, transform 0.2s;
}

.result-card:hover {
  transform: translateY(1px); /* Tactile press */
  border-color: var(--a-color-muted-soft);
}
```

- [ ] **Step 2: Commit changes**

```bash
git commit -am "style: paperize listening history rows and custom playlist cards in starred view"
```

---

### Task 3: Complete Final Verification

- [ ] **Step 1: Run unit tests to check functionality**

Run: `bun run test:unit tests/unit/views/music/MusicExploreView.spec.ts`
