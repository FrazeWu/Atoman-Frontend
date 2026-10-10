# User, Settings & Auth UI Redesign Specification (Pure-White Double-Notch Minimal System)

## 1. Context & Objective

Following the successful migration of Books, Shared/Portal, Forum/Debate, Feed/Video, Music/Podcast, and Timeline modules, the `user`, `setting`, and `auth` modules must be aligned with the **Pure-White Double-Notch Minimal System** specification (`docs/specs/2026-06-05-flat-paper-ui-design.md`, `design_system.md`, and `AGENTS.md`).

## 2. Design Contracts & Principles

1. **R1 Solid Pure-White Surfaces**:
   - Authentication pages (`.auth-page`, `.oauth-flow-page`) must use solid `var(--a-color-bg)` (#ffffff). Eliminate all background grid mesh textures (`linear-gradient(...)`).
   - Settings cards and directory panels (`SettingAccessView`, `SettingAnnouncementsView`, `SettingForumGroupPanel`, etc.) must use `var(--a-color-bg)`.
2. **R2 Soft Dividers**:
   - Replace all ad-hoc borders with `var(--a-color-border)` (#cbd5e1) and inner dividers with `var(--a-color-border-soft)` (#e2e8f0).
3. **R3 Minimal Shadows**:
   - Only `var(--a-shadow-*)` or `none`. Eradicate ad-hoc `rgb(0 0 0 / 16%)` and pixel box shadows.
4. **R4 4px Standardized Radii**:
   - Standardize all badges, avatar boxes, switches, and shortcuts from `999px`, `50%`, `6px`, `3px` to 4px (`var(--a-radius-card)` / `var(--a-radius-control)`).
5. **R5 Typography Restraint**:
   - Main page titles, modal titles, and section headers must be `font-weight: 500`.
   - Strong/emphasis text must be clamped to `font-weight: 600`. Eliminate `700`, `800`, `650`, and `bold`.
6. **R8 Copy Restraint & De-jargonization (AGENTS.md)**:
   - Eliminate English uppercase kickers (`SITE ACCESS`, `MODULE MANAGEMENT`, `ROLE MANAGEMENT`, `01 / PROFILE`, `DANGER ZONE`, `MY ATOMAN`).
   - Eliminate developer-facing phrasing: replace "处理理由" with "填写原因" in review inputs; replace hyphenated titles ("目录-账号设置", "订阅源-条目") with natural Chinese titles.
7. **R9 Component & Button Contracts**:
   - Replace any remaining `outline` props with `variant="secondary"`.
   - Upgrade native `<select>` to `PSelect` where appropriate.
   - Upgrade native action buttons to `PButton`.
8. **R10 Semantic Tokens**:
   - Replace undefined tokens: `var(--a-color-accent)` -> `var(--a-color-primary)`, `var(--a-color-accent-success)` -> `var(--a-color-success)`, `var(--a-color-accent-destructive)` -> `var(--a-color-danger)`.
   - Replace non-token hex colors (`#b45309`, `#166534`, `#991b1b`, `#fff`, `#f9fafb`) with semantic tokens (`var(--a-color-warning)`, `var(--a-color-blog)`, `var(--a-color-danger)`, `var(--a-color-bg)`, `var(--a-color-surface-muted)`).

## 3. Scope & Phasing

- **Task 1: Auth Module Views & CSS** (`src/views/auth/*`, `src/components/auth/*`)
- **Task 2: User Profile & Settings Panels** (`src/views/user/*`, `src/components/user/*`)
- **Task 3: Setting Management Views & Panels** (`src/views/setting/*`, `src/components/setting/*`)
- **Task 4: Full System Integration & Verification**
