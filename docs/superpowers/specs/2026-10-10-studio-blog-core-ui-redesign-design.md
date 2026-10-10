# Design Spec: Studio, Blog, Comment, ShortNote & DM UI Redesign (Pure-White Double-Notch Minimal System)

## 1. Context & Objective

Complete the website-wide UI standardization under the **Pure-White Double-Notch Minimal System** specification (`docs/specs/2026-06-05-flat-paper-ui-design.md`, `design_system.md`, and `AGENTS.md`) across all remaining modules:
- Blog (`src/views/blog/`, `src/components/blog/`)
- Studio (`src/views/studio/`, `src/components/studio/`)
- Comment (`src/components/comment/`)
- Content & ShortNote (`src/components/content/`, `src/components/shortnote/`)
- Search & DM (`src/components/search/`, `src/components/dm/`)

## 2. Design Principles & Rules

1. **R1 Solid Pure-White Surfaces**:
   - Card, panel, sheet, header, and search frame backgrounds must use `#ffffff` / `var(--a-color-bg)`.
   - Eliminate all instances of `var(--a-color-surface)` as surface background in cards, headers, review prompts, and search dropdowns.
   - Remove all `backdrop-filter: blur(...)`.
   - Eradicate warm paper `#fffdf0` in CodeMirror active line indicators, replacing with pure white / minimal grey wash.
2. **R2 Soft Dividers**:
   - Dividers must use `var(--a-color-border)` and internal dividers `var(--a-color-border-soft)`.
   - Eliminate hardcoded border colors (`#bdbdbd`, `#b7791f`, `#dc2626`, `#ef4444`, `#e4e4e7`).
3. **R3 Minimal Shadows**:
   - Only `var(--a-shadow-*)` or `none`. Eradicate ad-hoc `rgba(...)` box shadows.
4. **R4 Standard 4px Radii**:
   - Standardize all badges, chips, memo buttons, avatar boxes, and switches from `999px`, `9999px`, `50%`, `12px` to 4px (`var(--a-radius-card)` / `var(--a-radius-control)`).
5. **R5 Typography Restraint**:
   - All section headers, card titles, and modal headers must be `font-weight: 500`.
   - Emphasis states and strong text must be clamped to `font-weight: 600`. Eliminate `700`, `800`, `650`, and `550`.
6. **R7 Component & Button Contracts**:
   - Migrate all deprecated `<PButton outline>` call sites to `<PButton variant="secondary">`.
7. **R8 Copy Restraint & De-jargonization (AGENTS.md)**:
   - Localize English uppercase kickers (`CHANNELS` -> `频道`, `CONTENT` -> `内容`).
   - Remove forced uppercase transformations (`text-transform: uppercase`).
8. **R10 Semantic Tokens**:
   - Replace legacy `var(--a-color-accent-destructive)` with semantic token `var(--a-color-danger)`.
   - Replace undefined `var(--a-color-fg-muted)` with `var(--a-color-muted)`.
   - Replace hardcoded hex colors (`#10b981`, `#f59e0b`, `#d97706`, `#ef4444`, `#3b82f6`, `#8b5cf6`, `#9ca3af`) with design tokens (`var(--a-color-success)`, `var(--a-color-warning)`, `var(--a-color-danger)`, `var(--a-color-primary)`).
