# List Displacement & Sequence Reordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement real-time displacement squeeze animation on drag and instant sequence number input reordering in both the Audio Player Queue (`AudioPlayerQueue.vue`) and the Studio Unified Collection Content Detail list (`StudioUnifiedCollectionDetailView.vue`).

**Architecture:** Extend existing drag-and-drop structures with dynamic row displacement styles (`is-displaced-down`, `is-displaced-up`, `is-dragged`), dynamic `--dragged-item-height` CSS properties, and pure-white `.q-sequence` / `.collection-item-sequence` input fields that clamp and splice item positions instantly on `@change`.

**Tech Stack:** Vue 3.5, TypeScript 5.9, Vite, Pinia 3, Vitest, Tabler Icons.

## Global Constraints

- Surfaces: Solid pure-white surfaces use `var(--a-color-bg)` or `#ffffff`. Muted surfaces use `var(--a-color-surface-muted)`. Never use `var(--a-color-surface)` as item backgrounds.
- Dividers: Boundaries use `var(--a-color-border)`, inner separators use `var(--a-color-border-soft)`.
- Radius: Standard controls use `var(--a-radius-control)` (4px). Never use `999px` pills.
- Typography: Headings and titles use `font-weight: 500`. Sequence numbers and tabular numbers use `500` with `font-variant-numeric: tabular-nums`. Never use `700`, `800`, or `bold`.
- Focus Rings: Use `outline: 2px solid var(--a-color-primary)` or `box-shadow: 0 0 0 1px var(--a-color-primary)`.
- Transitions: Fluid CSS `transform 0.22s cubic-bezier(0.2, 0, 0, 1)`.

---

### Task 1: Audio Player Queue Displacement & Sequence Input Reorder

**Files:**
- Modify: `src/components/music/AudioPlayerQueue.vue`
- Test: `tests/unit/components/music/AudioPlayerQueue.spec.ts`

**Interfaces:**
- Consumes: `usePlayerStore()`, `moveQueueItem(currentIndex, targetIndex)`
- Produces: Polished `.queue-item` with `.q-sequence` editable input and `.is-displaced-down` / `.is-displaced-up` classes

- [x] **Step 1: Add unit tests for queue sequence editing and displacement**
  In `tests/unit/components/music/AudioPlayerQueue.spec.ts`, add test cases:
  - Reordering queue item via typing target sequence into `.q-sequence-input` (e.g. changing item 1 to 3 moves it to index 2).
  - Hovering / drag-over applies displacement classes to sibling rows.
  Run: `bun run test:unit tests/unit/components/music/AudioPlayerQueue.spec.ts` (verify new assertions fail).

- [x] **Step 2: Implement editable sequence input in `AudioPlayerQueue.vue`**
  - In `AudioPlayerQueue.vue`, replace the static `.q-idx` text with:
    ```html
    <span class="q-sequence">
      <span class="q-sequence__text">{{ (index + 1).toString().padStart(2, '0') }}</span>
      <input
        class="q-sequence__input"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        :value="(index + 1).toString().padStart(2, '0')"
        :aria-label="`修改歌曲 ${song.title} 队列序号`"
        title="修改序号以重排"
        @click.stop
        @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        @change="handleQueueSequenceChange(index, $event)"
      />
    </span>
    ```
  - Implement `handleQueueSequenceChange(index: number, event: Event)`:
    - Parse integer, clamp between `1` and `player.queue.length`.
    - If valid and different from `index + 1`, call `moveQueueItem(index, targetIndex)`.

- [x] **Step 3: Implement real-time displacement animation in `AudioPlayerQueue.vue`**
  - Add refs: `draggedQueueIndex`, `hoverQueueIndex`, `dragOverInsertionIndex`.
  - In `handleQueueDragStart(index, event)`: set `draggedQueueIndex`, dynamically set list property `--dragged-item-height` based on `row.offsetHeight`.
  - In `handleQueueDragOver(insertionIndex, event)`: calculate `hoverQueueIndex` to indicate the target insertion point.
  - Implement `getQueueDisplacementClass(index: number)`:
    - Returns `is-displaced-down` if `index >= hoverQueueIndex && index < draggedQueueIndex`.
    - Returns `is-displaced-up` if `index <= hoverQueueIndex && index > draggedQueueIndex`.
    - Returns `is-dragged` if `index === draggedQueueIndex`.
  - In `<style scoped>`:
    - Add transition: `transition: transform 0.22s cubic-bezier(0.2, 0, 0, 1), background-color 0.15s ease`.
    - Add `.queue-item.is-displaced-down` and `.queue-item.is-displaced-up` transforms using `var(--dragged-item-height, 52px)`.

- [x] **Step 4: Verify AudioPlayerQueue unit tests pass**
  Run: `bun run test:unit tests/unit/components/music/AudioPlayerQueue.spec.ts`
  Confirm all tests pass.

- [x] **Step 5: Commit Task 1**
  Commit: `feat(music): add real-time displacement and editable sequence reorder to AudioPlayerQueue`

---

### Task 2: Studio Collection Content Displacement & Sequence Reorder

**Files:**
- Modify: `src/views/studio/StudioUnifiedCollectionDetailView.vue`
- Test: `tests/unit/views/studio/StudioUnifiedCollectionDetailView.spec.ts`

**Interfaces:**
- Consumes: `useStudioStore()`, `reorderUnifiedCollectionContents(collectionID, contentIDs)`
- Produces: Polished `.studio-collection-detail__list li` with drag grip handle, editable sequence input, and displacement classes

- [x] **Step 1: Add unit tests for collection sequence editing and displacement**
  In `tests/unit/views/studio/StudioUnifiedCollectionDetailView.spec.ts`, add test cases:
  - Reordering collection item via direct sequence input calls `store.reorderUnifiedCollectionContents`.
  - Dragging item over slot shifts sibling rows and reorders contents.
  Run: `bun run test:unit tests/unit/views/studio/StudioUnifiedCollectionDetailView.spec.ts` (verify new assertions fail).

- [x] **Step 2: Add drag handle and displacement logic in `StudioUnifiedCollectionDetailView.vue`**
  - Import `IconGripVertical as GripVertical` from `@tabler/icons-vue`.
  - Add drag states: `draggedItemIndex`, `hoverItemIndex`, `dragOverInsertionIndex`.
  - Implement `handleDragStart(index, event)`, `handleDragOver(index, event)`, `handleDrop(index, event)`, `clearDragState()`.
  - Add `getDisplacementClass(index)` with `is-displaced-down` and `is-displaced-up`.
  - In template, add `<div class="studio-collection-detail__drag-handle" draggable="true" title="拖拽排序">`.

- [x] **Step 3: Implement editable sequence input in `StudioUnifiedCollectionDetailView.vue`**
  - Replace `<span class="studio-collection-detail__position">{{ index + 1 }}</span>` with:
    ```html
    <span class="collection-item-sequence">
      <span class="collection-item-sequence__text">{{ index + 1 }}</span>
      <input
        class="collection-item-sequence__input"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        :value="index + 1"
        :aria-label="`修改内容 ${item.title} 序号`"
        title="修改序号以重排"
        @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        @change="handleSequenceChange(index, $event)"
      />
    </span>
    ```
  - Implement `handleSequenceChange(index: number, event: Event)`:
    - Parses integer, clamps between `1` and `items.length`.
    - Splices and moves item to target index.
    - Calls `saveOrder()` to persist through `studio.reorderUnifiedCollectionContents(...)`.

- [x] **Step 4: Style displacement and sequence input in `StudioUnifiedCollectionDetailView.vue`**
  - Add `.collection-item-sequence` and `.collection-item-sequence__input` styling adhering to design tokens.
  - Add `.studio-collection-detail__drag-handle` styling.
  - Add `transition: transform 0.22s cubic-bezier(0.2, 0, 0, 1)` and displacement transforms.

- [x] **Step 5: Verify StudioUnifiedCollectionDetailView unit tests pass**
  Run: `bun run test:unit tests/unit/views/studio/StudioUnifiedCollectionDetailView.spec.ts`
  Confirm all tests pass.

- [x] **Step 6: Commit Task 2**
  Commit: `feat(studio): add drag displacement and editable sequence reorder to collection contents`

---

### Task 3: Whole-Module Integration & Final Verification

- [x] **Step 1: Run unit tests for affected modules**
  Run: `bun run test:unit tests/unit/components/music/AudioPlayerQueue.spec.ts tests/unit/views/studio/StudioUnifiedCollectionDetailView.spec.ts`

- [x] **Step 2: Run design system contract tests**
  Run: `bun run test:unit tests/unit/ui/design-system-contract.spec.ts`

- [x] **Step 3: Run TypeScript type check**
  Run: `bun run type-check`

- [x] **Step 4: Run production build check**
  Run: `bun run build`

- [x] **Step 5: Check git diff**
  Run: `git diff --check`
