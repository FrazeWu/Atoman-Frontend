# Borderless White UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove hard structural divider lines from the Atoman frontend while preserving the existing topbar, sidebar, and content layouts.

**Architecture:** Implement the redesign through shared styles first: global tokens/classes, `AppTopbar`, and `PaperSidebar`/`PaperSidebarItem`. Page-specific work is limited to obvious structural borders that do not come from shared primitives. Visual behavior is CSS-only: white surfaces, no separators, hover/active states via gray backgrounds or shadows, and no hover movement.

**Tech Stack:** Vue 3.5, Vite, TypeScript 5.9 strict, Pinia, Vue Router, Vitest, CSS scoped styles and global `src/style.css` tokens.

---

## Source Spec

- `docs/superpowers/specs/2026-06-10-borderless-white-ui-design.md`

## File Structure

- Modify: `src/style.css`
  - Owns global A* primitives and layout classes. Add/adjust white-surface and borderless item styles here so modules inherit the redesign without page rewrites.
- Modify: `src/components/AppTopbar.vue`
  - Owns global topbar. Remove permanent bottom border and replace nav hover/active feedback with background/shadow/text styling without movement.
- Modify: `src/components/ui/PaperSidebar.vue`
  - Owns sidebar container behavior. Keep structure/collapse behavior, avoid adding structural borders.
- Modify: `src/components/ui/PaperSidebarItem.vue`
  - Owns sidebar item focus styling. Replace inset border-like focus with background/shadow/text treatment that does not read as a divider.
- Create: `tests/unit/ui/borderless-white-ui.spec.ts`
  - Locks the shared CSS constraints that matter for this redesign: no topbar bottom border, no sidebar inset focus line, hover transitions do not use transform, and global card hover uses shadow rather than movement.

## Task 1: Add CSS contract tests for borderless shared UI

**Files:**
- Create: `tests/unit/ui/borderless-white-ui.spec.ts`

- [ ] **Step 1: Create the failing test file**

Create `tests/unit/ui/borderless-white-ui.spec.ts` with this exact content:

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../../..')

const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const cssBlock = (css: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm'))
  return match?.[1] ?? ''
}

describe('borderless white UI contract', () => {
  it('keeps the app topbar borderless and uses non-moving nav feedback', () => {
    const source = read('src/components/AppTopbar.vue')

    expect(source).not.toMatch(/border-bottom:\s*1px/)
    expect(source).not.toMatch(/border-bottom-color/)
    expect(source).not.toMatch(/transform:\s*translate/)
    expect(source).toContain('box-shadow')
    expect(source).toContain('background: var(--a-color-paper-wash)')
  })

  it('keeps sidebar focus visible without an inset divider line', () => {
    const source = read('src/components/ui/PaperSidebarItem.vue')

    expect(source).not.toContain('box-shadow: inset 4px 0 0')
    expect(source).not.toMatch(/border-left/)
    expect(source).toContain('background: var(--a-color-paper-wash)')
    expect(source).toContain('box-shadow: var(--a-shadow-paper-sm)')
  })

  it('uses shadows for global card hover without hover movement', () => {
    const css = read('src/style.css')
    const cardHoverBlock = cssBlock(css, '.a-card-hover:hover')

    expect(cardHoverBlock).toContain('box-shadow: var(--a-shadow-paper-sm)')
    expect(cardHoverBlock).not.toMatch(/transform\s*:/)
  })
})
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
bun run test:unit -- tests/unit/ui/borderless-white-ui.spec.ts
```

Expected: FAIL. At minimum, the current code still contains `border-bottom: 1px` in `src/components/AppTopbar.vue`, `border-bottom-color`, and `box-shadow: inset 4px 0 0` in `src/components/ui/PaperSidebarItem.vue`.

- [ ] **Step 3: Commit the failing contract test only**

```bash
git add tests/unit/ui/borderless-white-ui.spec.ts
git commit -m "test: add borderless UI contract"
```

## Task 2: Make the topbar borderless without changing its structure

**Files:**
- Modify: `src/components/AppTopbar.vue`
- Test: `tests/unit/ui/borderless-white-ui.spec.ts`

- [ ] **Step 1: Update topbar styles**

In `src/components/AppTopbar.vue`, replace the current `<style scoped>` block with this block:

```vue
<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--a-color-bg);
  height: 56px;
}
.topbar--auth {
  background: var(--a-color-bg);
}
.topbar-inner {
  padding: 0 24px;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 2rem;
}
.topbar-inner--auth {
  flex: 1;
  max-width: 1120px;
  margin: 0 auto;
  justify-content: space-between;
}
.brand-link {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: var(--a-color-fg);
  flex-shrink: 0;
}
.logo-box {
  width: 32px;
  height: 32px;
  background-color: var(--a-color-fg);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--a-shadow-paper-sm);
}
.logo-inner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--a-color-bg);
  transform: rotate(45deg);
}
.logo-text {
  font-weight: 900;
  font-size: 1.2rem;
  letter-spacing: -0.02em;
}
.auth-kicker {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.28em;
  color: var(--a-color-muted);
}
.nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}
.nav-link {
  display: flex;
  align-items: center;
  min-height: 2.25rem;
  padding: 0 0.75rem;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--a-color-muted);
  text-decoration: none;
  background: transparent;
  transition: color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}
.nav-link-name { font-weight: 900; }
.nav-link:hover {
  color: var(--a-color-fg);
  background: var(--a-color-paper-wash);
  box-shadow: var(--a-shadow-paper-sm);
  text-decoration: none;
}
.nav-link.active {
  color: var(--a-color-fg);
  background: var(--a-color-paper-wash);
  box-shadow: var(--a-shadow-paper-sm);
}
.nav-sep { color: var(--a-color-line); }
.nav-link-sm {
  min-height: 2rem;
  display: inline-flex;
  align-items: center;
  padding: 0 0.625rem;
  border-radius: 0.625rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--a-color-muted-soft);
  text-decoration: none;
  transition: color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}
.nav-link-sm:hover {
  color: var(--a-color-fg);
  background: var(--a-color-paper-wash);
  box-shadow: var(--a-shadow-paper-sm);
  text-decoration: none;
}
.nav-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: auto;
}

@media (max-width: 720px) {
  .topbar-inner {
    padding: 0 16px;
    gap: 1rem;
  }

  .nav {
    gap: 0.25rem;
    overflow-x: auto;
  }

  .nav-link {
    padding: 0 0.625rem;
  }

  .auth-kicker {
    display: none;
  }
}
</style>
```

- [ ] **Step 2: Run the focused contract test**

Run:

```bash
bun run test:unit -- tests/unit/ui/borderless-white-ui.spec.ts
```

Expected: still FAIL because sidebar and global card styles have not been updated yet. The topbar-specific assertions should now pass.

- [ ] **Step 3: Run existing topbar tests**

Run:

```bash
bun run test:unit -- tests/unit/AppTopbar.roomNames.spec.ts tests/unit/AppTopbar.kanbo.spec.ts
```

Expected: PASS. These tests prove the topbar structure, module names, and kanbo behavior did not change.

- [ ] **Step 4: Commit the topbar change**

```bash
git add src/components/AppTopbar.vue
git commit -m "style: make topbar borderless"
```

## Task 3: Make sidebar items borderless and non-moving

**Files:**
- Modify: `src/components/ui/PaperSidebarItem.vue`
- Modify: `src/components/ui/PaperSidebar.vue`
- Test: `tests/unit/ui/borderless-white-ui.spec.ts`

- [ ] **Step 1: Replace sidebar item scoped styles**

In `src/components/ui/PaperSidebarItem.vue`, replace the current `<style scoped>` block with this block:

```vue
<style scoped>
.a-sidebar-item {
  outline: none;
  border-radius: 0.875rem;
  transition: background-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
}
.a-sidebar-item:hover,
.a-sidebar-item.is-focused {
  background: var(--a-color-paper-wash);
  box-shadow: var(--a-shadow-paper-sm);
}
.a-sidebar-item.active {
  background: var(--a-color-paper-wash);
  color: var(--a-color-ink);
  box-shadow: var(--a-shadow-paper-sm);
}
</style>
```

- [ ] **Step 2: Keep collapsed sidebar behavior borderless**

In `src/components/ui/PaperSidebar.vue`, keep the existing template and script unchanged. In its `<style scoped>` block, update only `.a-sidebar-collapse-btn` and `.a-sidebar-collapse-btn:hover` to this exact CSS:

```css
.a-sidebar-collapse-btn {
  position: absolute;
  top: 1.25rem;
  left: 1.25rem;
  width: 2.5rem;
  height: 2.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
  border-radius: 0.875rem;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
  z-index: 10;
}

.a-sidebar-collapse-btn:hover {
  background: var(--a-color-paper-wash);
  box-shadow: var(--a-shadow-paper-sm);
}
```

Do not change collapse widths, icon visibility, nav slot behavior, or media queries.

- [ ] **Step 3: Run the focused contract test**

Run:

```bash
bun run test:unit -- tests/unit/ui/borderless-white-ui.spec.ts
```

Expected: still FAIL only on the global card hover assertion, because `src/style.css` still uses `var(--a-shadow-dropdown)` for `.a-card-hover:hover`.

- [ ] **Step 4: Run existing sidebar-related tests**

Run:

```bash
bun run test:unit -- tests/unit/SidebarRoomNames.spec.ts tests/unit/feed-layering.spec.ts tests/unit/blog-layering.spec.ts
```

Expected: PASS. These tests catch accidental route/sidebar naming or layering regressions.

- [ ] **Step 5: Commit the sidebar change**

```bash
git add src/components/ui/PaperSidebar.vue src/components/ui/PaperSidebarItem.vue
git commit -m "style: make sidebar states borderless"
```

## Task 4: Update global card hover and shared borderless primitives

**Files:**
- Modify: `src/style.css`
- Test: `tests/unit/ui/borderless-white-ui.spec.ts`

- [ ] **Step 1: Add borderless surface tokens**

In `src/style.css`, inside the `:root` block after `--a-shadow-paper-lg`, add these tokens:

```css
  --a-shadow-hover: 0 8px 24px rgba(15, 23, 42, 0.08);
  --a-shadow-active: 4px 4px 0 rgba(15, 23, 42, 0.14);
```

- [ ] **Step 2: Replace global card styles**

In `src/style.css`, replace the existing card block at `.a-card`, `.a-card-hover:hover`, and `.a-card-sm` with this CSS:

```css
.a-card {
  padding: var(--a-space-5);
  background: var(--a-color-bg);
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}
.a-card-hover:hover {
  background: var(--a-color-bg);
  box-shadow: var(--a-shadow-paper-sm);
}
.a-card-sm {
  padding: var(--a-space-4);
  background: var(--a-color-bg);
}
```

This intentionally removes `border: var(--a-border)` from generic cards. Do not change `.a-modal`, `.a-btn`, `.a-input`, `.a-textarea`, or `.a-select` in this task because the spec allows controls and input affordances to keep strong borders.

- [ ] **Step 3: Run the focused contract test**

Run:

```bash
bun run test:unit -- tests/unit/ui/borderless-white-ui.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Run layering and shared component tests**

Run:

```bash
bun run test:unit -- tests/unit/layering-contract.spec.ts tests/unit/layering-imports.spec.ts tests/unit/PaperSheet.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the global style change**

```bash
git add src/style.css tests/unit/ui/borderless-white-ui.spec.ts
git commit -m "style: update shared borderless surfaces"
```

## Task 5: Sweep page-specific structural borders without changing layouts

**Files:**
- Inspect: `src/views/**/*.vue`
- Inspect: `src/components/**/*.vue`
- Modify only files with structural page/card/list dividers that remain visually obvious after Tasks 2-4.

- [ ] **Step 1: Find remaining structural border declarations**

Run:

```bash
grep -RIn "border-bottom\|border-right\|border-left\|border: var(--a-border)\|divide-" src/views src/components | grep -v "node_modules" || true
```

Expected: A list of candidates. Treat controls, form inputs, modal borders, primary buttons, and `PaperField` bottom lines as allowed unless they are being used as page layout separators.

- [ ] **Step 2: Classify each candidate before editing**

For each result, classify it into one of these buckets in your notes before editing:

```text
KEEP_CONTROL: input/button/modal/action affordance, allowed by spec.
KEEP_INPUT: PaperField or manuscript input line, allowed by spec.
CHANGE_STRUCTURE: page, card, list, topbar, sidebar, or section separator, should be removed or replaced.
```

Do not edit files in the KEEP buckets.

- [ ] **Step 3: Apply minimal CSS-only edits to CHANGE_STRUCTURE files**

For each `CHANGE_STRUCTURE` declaration, use one of these replacements:

```css
/* Remove structural border entirely when spacing already separates content. */
border: none;

/* Or replace boxed separation with hover-only emphasis. */
transition: background-color 0.2s ease, box-shadow 0.2s ease;
```

For hover/focus states use this pattern:

```css
.selector:hover {
  background: var(--a-color-paper-wash);
  box-shadow: var(--a-shadow-paper-sm);
}
```

Do not add `transform`, `translate`, or layout-changing hover styles.

- [ ] **Step 4: Run targeted tests for touched modules**

Run the test files that correspond to any touched modules. If the sweep touches feed, music, or kanbo pages, run these examples as applicable:

```bash
bun run test:unit -- tests/unit/feed-layering.spec.ts tests/unit/MusicLayout.spec.ts tests/unit/MediaLayout.spec.ts
```

Expected: PASS for every touched area. If a touched area has no specific test, note that it will be covered by browser verification in Task 6.

- [ ] **Step 5: Commit page-specific sweep**

Stage only files changed in this task:

```bash
git add <each-touched-src-file>
git commit -m "style: remove structural page dividers"
```

## Task 6: Verify type safety and browser behavior

**Files:**
- No source edits unless verification reveals a bug.

- [ ] **Step 1: Run type check**

Run:

```bash
bun run type-check
```

Expected: PASS.

- [ ] **Step 2: Run the focused and affected unit tests**

Run:

```bash
bun run test:unit -- tests/unit/ui/borderless-white-ui.spec.ts tests/unit/AppTopbar.roomNames.spec.ts tests/unit/AppTopbar.kanbo.spec.ts tests/unit/SidebarRoomNames.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Start the dev server**

Run:

```bash
bun run dev
```

Expected: Vite prints a local URL. Keep the server running for browser verification.

- [ ] **Step 4: Browser-check representative pages**

Use the browser to inspect these representative routes:

```text
/
/explore
/login
```

If the app redirects based on auth state, use the visible Feed/sidebar page, one content-heavy page, and the login/auth layout available in the current session.

Confirm visually:

```text
- Topbar has no permanent bottom divider line.
- Sidebar has no permanent right divider line.
- Generic cards/lists do not rely on full hard boxes for separation.
- Hover states show gray background or shadow only.
- Hover states do not move elements.
- Active topbar/sidebar states are still obvious.
- Major surfaces remain white.
```

- [ ] **Step 5: Fix any verification issues with minimal CSS-only changes**

If verification reveals a visual regression, edit only the component or page causing the issue. Use the same allowed patterns:

```css
background: var(--a-color-paper-wash);
box-shadow: var(--a-shadow-paper-sm);
transition: background-color 0.2s ease, box-shadow 0.2s ease;
```

Do not change routes, stores, API calls, or page structure.

- [ ] **Step 6: Re-run verification after fixes**

Run:

```bash
bun run type-check
bun run test:unit -- tests/unit/ui/borderless-white-ui.spec.ts tests/unit/AppTopbar.roomNames.spec.ts tests/unit/AppTopbar.kanbo.spec.ts tests/unit/SidebarRoomNames.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit verification fixes if any**

If Step 5 changed files:

```bash
git add <each-fixed-file>
git commit -m "style: polish borderless UI verification"
```

If Step 5 made no changes, skip this commit.

## Self-Review

- Spec coverage: covered white surfaces, removal of hard structural separators, preserving current topbar/sidebar/content structures, no hover movement, control/input exceptions, type check, and browser verification.
- Placeholder scan: no placeholder markers remain. Task 5 uses controlled classification because exact page-specific border files must be discovered against current source before editing.
- Type consistency: all referenced files and commands exist in this Vue/Vitest/Bun project. Test helper paths resolve from `tests/unit/ui` to the repository root.
