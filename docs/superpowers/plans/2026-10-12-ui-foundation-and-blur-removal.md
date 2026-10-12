# UI Foundation Standardization and Blur Eradication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize core UI foundation primitives to strictly adhere to the 4px radii, font-weight 500, and pure-white token contract, and completely eliminate all 8 occurrences of `backdrop-filter: blur` across the frontend.

**Architecture:** Update foundational components in `src/components/ui/`, `src/components/system/`, and `src/components/shared/` to replace non-compliant radii (`8px`, `999px`), bold weights (`700`, `650`), and `var(--a-color-surface)` fills with design tokens. Replace all blurry overlays with solid/tokenized backdrops. Enforce this in `tests/unit/ui/design-system-contract.spec.ts`.

**Tech Stack:** Vue 3.5, TypeScript 5.9, CSS Design Tokens (`src/style.css`), Vitest.

## Global Constraints

- Rect/card radii strictly `var(--a-radius-card, 4px)` or `var(--a-radius-control, 4px)`. No 8px, 12px, 16px, or 999px pills.
- Surfaces and panels must use `var(--a-color-bg)` / solid white. Never raw `var(--a-color-surface)`.
- Headings and labels must use `font-weight: 500` (emphasis `600`). No `650`, `700`, `800`, or `bold`.
- Zero occurrences of `backdrop-filter: blur` in `src/`.
- Colors must be sourced from design tokens. No ad hoc `#3b82f6` or Tailwind utilities (`text-red-500`).

---

### Task 1: Standardize UI Foundation Primitives (Radii, Weights, Tokens)

**Files:**
- Modify: `src/components/ui/PField.vue`
- Modify: `src/components/ui/PToast.vue`
- Modify: `src/components/ui/PDirectoryNav.vue`
- Modify: `src/components/ui/PContentProgress.vue`
- Modify: `src/components/ui/PContentCard.vue`
- Modify: `src/components/ui/PInteractionActions.vue`
- Modify: `src/components/ui/PSheet.vue`
- Modify: `src/components/music/MusicLyricsRowEditor.vue`

**Interfaces:**
- Consumes: `--a-radius-card`, `--a-radius-control`, `--a-radius-none`, `--a-color-bg`, `--a-color-danger`, `--a-color-primary`, `--a-shadow-dropdown`
- Produces: Normalized component styling adhering to design tokens.

- [ ] **Step 1: Update `PField.vue`**

In `src/components/ui/PField.vue`:
Replace:
```vue
      <span v-if="required" class="text-red-500">*</span>
```
with:
```vue
      <span v-if="required" class="p-field-required">*</span>
```
And in `<style scoped>`:
```css
.p-field-required {
  color: var(--a-color-danger);
}
.p-field-error-msg {
  font-size: 0.75rem;
  color: var(--a-color-danger);
  margin-top: 0.25rem;
  font-weight: 500;
}
```

- [ ] **Step 2: Update `PToast.vue`**

In `src/components/ui/PToast.vue`:
Replace line 121:
```css
  background: var(--a-color-surface);
```
with:
```css
  background: var(--a-color-bg);
```
Replace line 135:
```css
  border-radius: 8px;
```
with:
```css
  border-radius: var(--a-radius-card, 4px);
```

- [ ] **Step 3: Update `PDirectoryNav.vue`**

In `src/components/ui/PDirectoryNav.vue`:
Replace lines 126-129:
```css
  border-radius: 8px;
  background: var(--a-color-surface);
  box-shadow: 0 12px 28px
    color-mix(in srgb, var(--a-color-text) 12%, transparent);
```
with:
```css
  border-radius: var(--a-radius-card, 4px);
  background: var(--a-color-bg);
  box-shadow: var(--a-shadow-dropdown);
```
Replace lines 284-285:
```css
  border-radius: 8px;
  background: var(--a-color-surface) !important;
```
with:
```css
  border-radius: var(--a-radius-card, 4px);
  background: var(--a-color-bg) !important;
```

- [ ] **Step 4: Update `PContentProgress.vue`**

In `src/components/ui/PContentProgress.vue`:
Replace lines 178 and 187:
```css
  border-radius: 999px;
```
with:
```css
  border-radius: var(--a-radius-none, 0px);
```
And replace `#3b82f6` fallbacks with token on lines 186 and 224:
```css
  background: var(--a-color-primary);
...
  color: var(--a-color-primary);
```

- [ ] **Step 5: Update `PContentCard.vue`, `PInteractionActions.vue`, `PSheet.vue`, and `MusicLyricsRowEditor.vue`**

In `src/components/ui/PContentCard.vue`:
Line 137:
```css
  border-radius: var(--a-radius-none, 0px);
```

In `src/components/ui/PInteractionActions.vue`:
Line 135:
```css
  border-radius: var(--a-radius-control, 4px);
```

In `src/components/ui/PSheet.vue`:
Line 617:
```css
  font-weight: 500;
```

In `src/components/music/MusicLyricsRowEditor.vue`:
Lines 391, 452, 544:
Replace `border-radius: 8px;` with:
```css
  border-radius: var(--a-radius-control, 4px);
```

- [ ] **Step 6: Run existing UI test suite to verify no regressions**

Run: `bun run test:unit tests/unit/ui/`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/ src/components/music/MusicLyricsRowEditor.vue
git commit -m "style(ui): standardize core component radii, weights, and color tokens"
```

---

### Task 2: Eradicate All Backdrop Blur Occurrences

**Files:**
- Modify: `src/components/system/AppTopbarGlobalSearch.vue`
- Modify: `src/components/shared/PVideoCard.vue`
- Modify: `src/components/music/MusicAlbumCard.vue`
- Modify: `src/components/video/VideoPlayerControls.vue`
- Modify: `src/views/dev/BlogExploreTemplateView.vue`
- Modify: `src/views/dev/BlogTemplateView.vue`

**Interfaces:**
- Produces: Clean solid overlays without blur filters.

- [ ] **Step 1: Clean `AppTopbarGlobalSearch.vue`**

In `src/components/system/AppTopbarGlobalSearch.vue`:
Replace line 346-347:
```css
  background: color-mix(in srgb, var(--a-color-text) 45%, transparent);
  backdrop-filter: blur(4px);
```
with:
```css
  background: var(--a-color-overlay-soft, rgba(15, 23, 42, 0.45));
```

- [ ] **Step 2: Clean `PVideoCard.vue`**

In `src/components/shared/PVideoCard.vue`:
Lines 186-187:
```css
  background: rgba(15, 23, 42, 0.85);
```
(remove `backdrop-filter: blur(8px);`)

Line 213:
```css
  border-radius: var(--a-radius-control, 4px);
```
(was `var(--a-radius-pill, 999px)`)

Lines 259-260 & 272-273:
```css
  background: rgba(15, 23, 42, 0.82);
```
(remove `backdrop-filter: blur(4px);`)

- [ ] **Step 3: Clean `MusicAlbumCard.vue`**

In `src/components/music/MusicAlbumCard.vue`:
Remove line 448 (`backdrop-filter: blur(4px);`). Keep `background: rgba(0, 0, 0, 0.82);`.

- [ ] **Step 4: Clean `VideoPlayerControls.vue`**

In `src/components/video/VideoPlayerControls.vue`:
Remove line 594 (`backdrop-filter: blur(12px);`). Keep `background: rgba(18, 18, 20, 0.95);`.

- [ ] **Step 5: Clean dev templates**

In `src/views/dev/BlogExploreTemplateView.vue:517` and `src/views/dev/BlogTemplateView.vue:370`:
Remove `backdrop-filter: blur(4px);`.

- [ ] **Step 6: Verify zero occurrences of backdrop blur**

Run: `git grep "backdrop-filter:\s*blur" src/`
Expected: 0 matches.

- [ ] **Step 7: Commit**

```bash
git add src/components/system/AppTopbarGlobalSearch.vue src/components/shared/PVideoCard.vue src/components/music/MusicAlbumCard.vue src/components/video/VideoPlayerControls.vue src/views/dev/
git commit -m "style(ui): eradicate backdrop blur across overlays and badges"
```

---

### Task 3: Add Automated Design System Contract Tests

**Files:**
- Modify: `tests/unit/ui/design-system-contract.spec.ts`

- [ ] **Step 1: Add blur prohibition test and component tokens test**

In `tests/unit/ui/design-system-contract.spec.ts`:
Add test:
```typescript
	it("prohibits backdrop-filter blur across all source files", () => {
		const source = sourceText("src");
		expect(source).not.toMatch(/backdrop-filter:\s*blur/);
	});

	it("enforces pure-white surface and 4px radius on PToast and PDirectoryNav", () => {
		const toast = read("src/components/ui/PToast.vue");
		const nav = read("src/components/ui/PDirectoryNav.vue");
		const field = read("src/components/ui/PField.vue");

		expect(toast).not.toContain("border-radius: 8px");
		expect(nav).not.toContain("border-radius: 8px");
		expect(field).not.toMatch(/font-weight:\s*700/);
		expect(field).not.toContain("text-red-500");
	});
```

- [ ] **Step 2: Run contract test**

Run: `bun run test:unit tests/unit/ui/design-system-contract.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/ui/design-system-contract.spec.ts
git commit -m "test(ui): add contract tests prohibiting backdrop blur and enforcing foundation tokens"
```

---

### Task 4: Full Verification and Regression Gate

**Files:**
- All modified files

- [ ] **Step 1: Run type checking**

Run: `bun run type-check`
Expected: 0 errors.

- [ ] **Step 2: Run all UI unit tests**

Run: `bun run test:unit tests/unit/ui/`
Expected: All tests pass.

- [ ] **Step 3: Run production build**

Run: `bun run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Check git diff**

Run: `git diff --check`
Expected: Clean.
