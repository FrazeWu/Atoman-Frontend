# Design Spec: List Real-Time Displacement & Instant Sequence Reordering

## 1. Context & Objectives

In commit `f50f9b08` and `2498576f`, we introduced a smooth, fluid list reordering experience for the music album track creation wizard (`MusicCreationAlbumDetailsStep.vue` and `useMusicAlbumTrackEditor.ts`). It solves two fundamental friction points in item reordering:
1. **Direct sequence input**: Instead of dragging across long distances or repeatedly clicking up/down buttons, users can directly edit an item's sequence number (e.g. typing `1` on item `12`), instantly splicing and reordering the item into that position.
2. **Real-time displacement animation**: When dragging an item, neighboring rows smoothly shift up or down with `transform: translateY(...)` (cubic-bezier easing) to visually open a slot where the item will drop, eliminating jarring jumps.

This specification rolls out this interaction pattern across two priority lists in `Atoman-Frontend`:
1. **Audio Player Queue** (`src/components/music/AudioPlayerQueue.vue`): The persistent audio playback queue.
2. **Studio Unified Collection Content List** (`src/views/studio/StudioUnifiedCollectionDetailView.vue`): The article/video/podcast list inside a Studio collection.

---

## 2. Component Design & Interactions

### 2.1 Audio Player Queue (`AudioPlayerQueue.vue`)

#### Current Behavior
- Relies on full-width drop slots (`.queue-drop-slot`) between items.
- Items have static index numbers (`01`, `02`) when not active, or equalizer animation when active.
- Dragging shows standard HTML5 drag ghost without neighboring item displacement.
- Mobile only has up/down buttons (`ChevronUp` / `ChevronDown`).

#### New Architecture & Interaction
1. **Sequence Number Input**:
   - For inactive items, the index number displays inside a `.q-sequence` container.
   - It features an accessible hidden label and a clean numeric input (`.q-sequence-input`):
     - Displays formatted 2-digit index (`01`, `02`, ...).
     - Standard pure-white style: `2.1rem` width, `1.85rem` height, `var(--a-radius-control)` (4px), `var(--a-color-bg)` background, `var(--a-color-border-soft)` border.
     - On `@change`, parses integer, validates `1 <= target <= queue.length`, and immediately calls `player.moveQueueItem(currentIndex, targetIndex)`.
     - On active item (currently playing song): displays the dynamic equalizer animation, but on hover or focus reveals the sequence number input so users can still reposition the currently playing track in the queue.
2. **Real-Time Displacement Animation**:
   - Introduce `draggedIndex`, `hoverIndex`, `dragOverInsertionIndex`.
   - Calculate displacement classes:
     - `.is-displaced-down`: `transform: translateY(calc(var(--dragged-item-height, 52px) + 0.25rem));`
     - `.is-displaced-up`: `transform: translateY(calc(-1 * (var(--dragged-item-height, 52px) + 0.25rem)));`
     - `.is-dragged`: `opacity: 0.35; background: color-mix(in srgb, var(--a-color-primary) 4%, var(--a-color-bg));`
   - Smooth transition: `transition: transform 0.22s cubic-bezier(0.2, 0, 0, 1)`.
   - On `@dragend` / `@drop`: cleanly reset all hover and dragged indices.

---

### 2.2 Studio Unified Collection Detail List (`StudioUnifiedCollectionDetailView.vue`)

#### Current Behavior
- Static `<ol class="studio-collection-detail__list">` with position text `<span class="studio-collection-detail__position">{{ index + 1 }}</span>`.
- Reordering is limited solely to clicking `PButton` `ChevronUp` and `ChevronDown` one step at a time.
- No drag handle and no direct sequence input.

#### New Architecture & Interaction
1. **Drag Handle & Row Dragging**:
   - Add a grip handle (`<GripVertical :size="15" />`, `.studio-collection-detail__drag-handle`) to the left of each item.
   - Support standard drag start/over/drop:
     - Dragging calculates row height `--dragged-collection-item-height` dynamically.
     - Overlapping sibling rows displace smoothly up or down.
2. **Sequence Number Direct Editing**:
   - Replace static position span with an editable `.collection-item-sequence`:
     - Accessible text `<span class="collection-item-sequence__text">{{ index + 1 }}</span>`.
     - Numeric input `<input class="collection-item-sequence__input" type="text" inputmode="numeric" :value="index + 1" />`.
     - On `@change`, moves item from `index` to `clamp(1, target, total) - 1`, updating the local items array and triggering `saveOrder()` to persist the reordered list to backend API (`reorderUnifiedCollectionItems`).
3. **Responsive & Mobile Fallbacks**:
   - Keep the existing `ChevronUp` / `ChevronDown` actions as keyboard/touch-friendly secondary controls.

---

## 3. Design Tokens & Visual Conformity

Both components strictly follow the Pure-White Double-Notch Minimal System:
- **Surface**: `var(--a-color-bg)` (#ffffff) default, `var(--a-color-surface-muted)` on hover.
- **Borders**: `var(--a-color-border-soft)` default, `var(--a-color-primary)` on focus.
- **Radii**: `var(--a-radius-control)` (4px).
- **Typography**: Sequence input font weight `500`, tabular numerals (`font-variant-numeric: tabular-nums`).
- **Focus Rings**: `box-shadow: 0 0 0 1px var(--a-color-primary)` or `outline: 2px solid var(--a-color-primary)`.

---

## 4. Testing & Verification

1. **Unit Tests**:
   - `tests/unit/components/music/AudioPlayerQueue.spec.ts`:
     - Test direct sequence input changes and confirms `player.moveQueueItem` is called with target indices.
     - Test drag start/over and verify displacement classes (`is-displaced-down`, `is-displaced-up`, `is-dragged`).
   - `tests/unit/views/studio-unified-collection-detail.spec.ts`:
     - Test drag reordering and sequence input triggering order updates.
     - Test out-of-bounds sequence input clamping.
2. **Contracts & Quality**:
   - `bun run type-check`: 0 type errors.
   - `bun run build`: 0 build warnings.
