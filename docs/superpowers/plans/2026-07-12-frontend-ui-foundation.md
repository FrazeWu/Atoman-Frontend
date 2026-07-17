# Frontend UI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shared Atoman frontend tokens and UI primitives enforce the approved white, flat, 4px, 500-weight visual system before module-specific cleanup begins.

**Architecture:** `src/style.css` remains the single token source. Shared components consume semantic tokens instead of module colors, while static contract tests catch visual regressions that DOM tests cannot observe in jsdom. This plan changes shared foundations only; Sheet stack behavior and module pages are handled by later plans.

**Tech Stack:** Vue 3, TypeScript, CSS custom properties, Vitest, Vue Test Utils, Bun

---

## File Map

- Create `tests/unit/ui/design-system-contract.spec.ts`: source-level assertions for canonical tokens and shared component styling.
- Modify `src/style.css`: primary, success, warning, danger, radius, weight, spacing, and flat-surface tokens.
- Modify `src/components/ui/PButton.vue`: semantic button variants and focus state.
- Modify `src/components/ui/PBadge.vue`: semantic status-dot colors.
- Modify `src/components/ui/PToast.vue`: warning support and semantic status-dot colors.
- Modify `src/components/ui/PCard.vue`: 4px flat card contract.
- Modify `src/components/ui/PSurface.vue`: 4px shadow-free surface contract.
- Modify `src/components/ui/PPageHeader.vue`: 500-weight title hierarchy.
- Modify `src/components/ui/PSectionHeader.vue`: 500-weight section hierarchy.
- Modify `src/components/ui/PShortcutHints.vue`: remove the remaining hard shadow and hover-only disclosure.
- Modify `tests/unit/components/PToast.spec.ts`: warning variant behavior.
- Modify `tests/unit/ui/borderless-white-ui.spec.ts`: replace obsolete 8px/shadow assertions with the approved 4px flat contract.

### Task 1: Lock the canonical token contract

**Files:**
- Create: `tests/unit/ui/design-system-contract.spec.ts`
- Modify: `src/style.css:1-79`

- [ ] **Step 1: Write the failing token test**

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('approved design-system contract', () => {
  it('defines canonical semantic colors and flat geometry', () => {
    const css = read('src/style.css')

    expect(css).toContain('--a-color-primary: #2563eb;')
    expect(css).toContain('--a-color-primary-hover: #1d4ed8;')
    expect(css).toContain('--a-color-primary-pressed: #1e40af;')
    expect(css).toContain('--a-color-success: #0d9488;')
    expect(css).toContain('--a-color-warning: #ea580c;')
    expect(css).toContain('--a-color-danger: #dc2626;')
    expect(css).toContain('--a-radius-base: 4px;')
    expect(css).toContain('--a-font-weight-strong: 500;')
    expect(css).toContain('--a-shadow-modal: none;')
  })

  it('does not retain module colors as global primary aliases', () => {
    const css = read('src/style.css')

    expect(css).not.toContain('--a-color-accent-confirm: var(--a-color-ink)')
    expect(css).not.toContain('--a-color-accent-destructive: #ea580c')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
bun run test:unit -- tests/unit/ui/design-system-contract.spec.ts
```

Expected: FAIL because the primary tokens and `--a-radius-base` do not exist and danger is still `#ef4444`.

- [ ] **Step 3: Replace the semantic token block**

Replace the matching declarations inside the existing `:root` block with the following declarations. Keep the existing spacing, typography-family, z-index, sidebar, and other unrelated tokens in the same `:root` block.

```css
--a-color-bg: #ffffff;
--a-color-fg: #0f172a;
--a-color-border: var(--a-color-line);
--a-color-surface: #f8fafc;
--a-color-muted: #64748b;
--a-color-muted-soft: #94a3b8;
--a-color-paper: #ffffff;
--a-color-paper-soft: #f8fafc;
--a-color-paper-wash: #f1f5f9;
--a-color-ink: #0f172a;
--a-color-ink-muted: #334155;
--a-color-ink-soft: #64748b;
--a-color-line: #cbd5e1;
--a-color-line-soft: #f1f5f9;

  --a-color-primary: #2563eb;
  --a-color-primary-hover: #1d4ed8;
  --a-color-primary-pressed: #1e40af;
  --a-color-primary-contrast: #ffffff;
  --a-color-success: #0d9488;
  --a-color-warning: #ea580c;
  --a-color-danger: #dc2626;
  --a-color-danger-bg: #ffffff;
  --a-color-danger-ink: #dc2626;
  --a-color-danger-line: #fecaca;

  --a-color-disabled-fg: #94a3b8;
  --a-color-disabled-border: #e2e8f0;
  --a-color-disabled-bg: #f1f5f9;

  --a-border-width: 1px;
  --a-border-style: solid;
  --a-border-color: var(--a-color-border);
  --a-border: var(--a-border-width) var(--a-border-style) var(--a-border-color);
  --a-radius-base: 4px;
  --a-radius-none: var(--a-radius-base);

  --a-shadow-button: none;
  --a-shadow-dropdown: none;
  --a-shadow-modal: none;
  --a-shadow-pressed: none;
  --a-shadow-paper-sm: none;
  --a-shadow-paper-md: none;
  --a-shadow-paper-lg: none;
  --a-shadow-hover: none;
  --a-shadow-active: none;

  --a-font-weight-normal: 500;
  --a-font-weight-strong: 500;
  --a-font-weight-black: 500;
--a-letter-spacing-tight: 0;
--a-letter-spacing-wide: 0;
--a-letter-spacing-widest: 0;
```

- [ ] **Step 4: Run the focused test and type-check**

```bash
bun run test:unit -- tests/unit/ui/design-system-contract.spec.ts
bun run type-check
```

Expected: both commands PASS.

- [ ] **Step 5: Commit the token contract**

```bash
git add src/style.css tests/unit/ui/design-system-contract.spec.ts
git commit -m "style(ui): define canonical design tokens"
```

### Task 2: Align shared buttons with semantic actions

**Files:**
- Modify: `tests/unit/ui/design-system-contract.spec.ts`
- Modify: `src/components/ui/PButton.vue:91-150`
- Test: `tests/unit/components/PButton.spec.ts`

- [ ] **Step 1: Add failing source assertions**

Append inside `describe('approved design-system contract', ...)`:

```ts
it('uses semantic colors for shared buttons', () => {
  const source = read('src/components/ui/PButton.vue')

  expect(source).toContain('background: var(--a-color-primary);')
  expect(source).toContain('background: var(--a-color-primary-hover);')
  expect(source).toContain('background: var(--a-color-primary-pressed);')
  expect(source).toContain('outline: 2px solid var(--a-color-primary);')
  expect(source).toContain('color: var(--a-color-danger);')
  expect(source).not.toContain('letter-spacing: 0.05em;')
})
```

- [ ] **Step 2: Verify the test fails**

```bash
bun run test:unit -- tests/unit/ui/design-system-contract.spec.ts tests/unit/components/PButton.spec.ts
```

Expected: the contract test FAILS because `PButton` still uses ink colors.

- [ ] **Step 3: Replace the button state styles**

```css
.p-button {
  border-radius: var(--a-radius-base);
  font-weight: 500;
  letter-spacing: 0;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.p-button:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

.p-button--primary {
  background: var(--a-color-primary);
  color: var(--a-color-primary-contrast);
  border-color: var(--a-color-primary);
}

.p-button--primary:hover:not(.p-button--disabled) {
  background: var(--a-color-primary-hover);
  border-color: var(--a-color-primary-hover);
}

.p-button--primary:active:not(.p-button--disabled) {
  background: var(--a-color-primary-pressed);
  border-color: var(--a-color-primary-pressed);
}

.p-button--danger {
  border-color: var(--a-color-danger-line);
  background: var(--a-color-paper);
  color: var(--a-color-danger);
}
```

Keep the existing `disabled`, size, block, and loading behavior unchanged.

- [ ] **Step 4: Run focused tests**

```bash
bun run test:unit -- tests/unit/ui/design-system-contract.spec.ts tests/unit/components/PButton.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/PButton.vue tests/unit/ui/design-system-contract.spec.ts
git commit -m "style(ui): align button action colors"
```

### Task 3: Align status components

**Files:**
- Modify: `src/components/ui/PBadge.vue`
- Modify: `src/components/ui/PToast.vue`
- Modify: `tests/unit/components/PToast.spec.ts`
- Modify: `tests/unit/ui/design-system-contract.spec.ts`

- [ ] **Step 1: Add failing warning and color tests**

Add to `tests/unit/components/PToast.spec.ts`:

```ts
it('renders warning toast with correct class', () => {
  const wrapper = mount(PToast, {
    props: {
      message: '需要重试',
      type: 'warning',
      modelValue: true,
    },
  })

  expect(wrapper.find('.p-toast').classes()).toContain('p-toast--warning')
})
```

Add to the design contract test:

```ts
it('maps status dots to semantic tokens', () => {
  const badge = read('src/components/ui/PBadge.vue')
  const toast = read('src/components/ui/PToast.vue')

  expect(badge).toContain('var(--a-color-success)')
  expect(badge).toContain('var(--a-color-warning)')
  expect(badge).toContain('var(--a-color-danger)')
  expect(toast).toContain('.p-toast--warning .p-toast-dot')
  expect(toast).toContain('var(--a-color-warning)')
})
```

- [ ] **Step 2: Verify failure**

```bash
bun run test:unit -- tests/unit/components/PToast.spec.ts tests/unit/ui/design-system-contract.spec.ts
```

Expected: FAIL because `warning` is not a valid toast type and status components use literals.

- [ ] **Step 3: Implement semantic status variants**

Change the toast prop type to:

```ts
type?: 'success' | 'warning' | 'danger' | 'error' | 'info'
```

Use these styles in both components:

```css
.p-badge.is-blog .p-badge-dot,
.p-badge.is-success .p-badge-dot,
.p-toast--success .p-toast-dot {
  background-color: var(--a-color-success);
}

.p-badge.is-video .p-badge-dot,
.p-badge.is-warning .p-badge-dot,
.p-toast--warning .p-toast-dot {
  background-color: var(--a-color-warning);
}

.p-badge.is-podcast .p-badge-dot,
.p-badge.is-danger .p-badge-dot,
.p-toast--danger .p-toast-dot,
.p-toast--error .p-toast-dot {
  background-color: var(--a-color-danger);
}
```

Set `.p-toast-title { font-weight: 500; }`.

- [ ] **Step 4: Run tests**

```bash
bun run test:unit -- tests/unit/components/PToast.spec.ts tests/unit/ui/design-system-contract.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/PBadge.vue src/components/ui/PToast.vue tests/unit/components/PToast.spec.ts tests/unit/ui/design-system-contract.spec.ts
git commit -m "style(ui): separate status color semantics"
```

### Task 4: Enforce flat 4px surfaces and 500-weight headings

**Files:**
- Modify: `src/components/ui/PCard.vue`
- Modify: `src/components/ui/PSurface.vue`
- Modify: `src/components/ui/PPageHeader.vue`
- Modify: `src/components/ui/PSectionHeader.vue`
- Modify: `src/components/ui/PShortcutHints.vue`
- Modify: `tests/unit/ui/borderless-white-ui.spec.ts`
- Modify: `tests/unit/ui/design-system-contract.spec.ts`

- [ ] **Step 1: Replace obsolete test expectations**

In `borderless-white-ui.spec.ts`, make the surface assertions read:

```ts
expect(pCardSource).toContain('border-radius: var(--a-radius-base);')
expect(pSurfaceSource).toContain('border-radius: var(--a-radius-base);')
expect(pCardSource).not.toContain('border-radius: 8px;')
expect(pSurfaceSource).not.toContain('border-radius: 8px;')
```

Add to `design-system-contract.spec.ts`:

```ts
it('keeps shared headings at 500 and shortcut help flat', () => {
  const pageHeader = read('src/components/ui/PPageHeader.vue')
  const sectionHeader = read('src/components/ui/PSectionHeader.vue')
  const shortcuts = read('src/components/ui/PShortcutHints.vue')

  expect(pageHeader).not.toMatch(/font-weight:\s*(700|800|900|950)/)
  expect(sectionHeader).not.toMatch(/font-weight:\s*(700|800|900|950)/)
  expect(shortcuts).not.toContain('box-shadow: 3px 3px')
  expect(shortcuts).toContain(':focus-within .shortcut-content')
})
```

- [ ] **Step 2: Verify failure**

```bash
bun run test:unit -- tests/unit/ui/borderless-white-ui.spec.ts tests/unit/ui/design-system-contract.spec.ts
```

Expected: FAIL on existing 8px radii, 700/800 weights, and hard shortcut shadow.

- [ ] **Step 3: Apply the shared surface rules**

Use these exact declarations:

```css
/* PCard.vue */
.p-card {
  border-radius: var(--a-radius-base);
}

/* PSurface.vue */
.p-surface {
  border-radius: var(--a-radius-base);
}

.p-surface--layer-0,
.p-surface--layer-1,
.p-surface--layer-2 {
  box-shadow: none;
}

/* PPageHeader.vue and PSectionHeader.vue */
.p-page-header__kicker,
.p-page-header__title,
.p-section-header__kicker,
.p-section-header__title {
  font-weight: 500;
  letter-spacing: 0;
}

/* PShortcutHints.vue */
.shortcut-trigger,
.shortcut-content,
.shortcut-item kbd {
  border-radius: var(--a-radius-base);
}

.shortcut-content {
  box-shadow: none;
}

.shortcut-info-wrap:hover .shortcut-content,
.shortcut-info-wrap:focus-within .shortcut-content {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
```

Do not change component props or slot APIs.

- [ ] **Step 4: Run focused and full shared tests**

```bash
bun run test:unit -- tests/unit/ui/borderless-white-ui.spec.ts tests/unit/ui/design-system-contract.spec.ts tests/unit/components/PButton.spec.ts tests/unit/components/PToast.spec.ts
bun run type-check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/PCard.vue src/components/ui/PSurface.vue src/components/ui/PPageHeader.vue src/components/ui/PSectionHeader.vue src/components/ui/PShortcutHints.vue tests/unit/ui/borderless-white-ui.spec.ts tests/unit/ui/design-system-contract.spec.ts
git commit -m "style(ui): flatten shared surfaces and headings"
```

### Task 5: Verify the foundation as an independent deliverable

**Files:**
- No source changes expected.

- [ ] **Step 1: Run the full static verification**

```bash
bun run type-check
bun run test:unit
bun run build
```

Expected: all commands exit `0`.

- [ ] **Step 2: Inspect the diff for forbidden regressions**

```bash
rg -n 'font-weight:\s*(700|800|900|950)|border-radius:\s*8px|box-shadow:\s*[1-9]' \
  src/components/ui/PButton.vue \
  src/components/ui/PBadge.vue \
  src/components/ui/PToast.vue \
  src/components/ui/PCard.vue \
  src/components/ui/PSurface.vue \
  src/components/ui/PPageHeader.vue \
  src/components/ui/PSectionHeader.vue \
  src/components/ui/PShortcutHints.vue
```

Expected: no matches except circular status dots, which use `50%` and are allowed.

- [ ] **Step 3: Confirm the worktree is clean after the task commits**

```bash
git status --short
```

Expected: no output.
