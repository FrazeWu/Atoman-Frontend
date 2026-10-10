# Feed & Video UI Redesign Design Spec

- **Date:** 2026-10-10
- **Scope:** Atoman-Frontend Feed (`src/views/feed/*`, `src/components/feed/*`) and Video (`src/views/video/*`, `src/components/video/*`) modules
- **Design System Benchmark:** Pure-White Double-Notch Minimal System (`style.css`, `design_system.md`, `AGENTS.md`)

---

## 1. Context & Objectives

Following the completed redesigns of Books, Studio, System Shell, Portal, and Forum & Debate, this specification targets the **Feed (信息流/订阅)** and **Video (视频消费/播放器)** modules to complete the full-site content consumption redesign.

### Core Contract Rules

1. **R1 纯白表面 (Pure-White Surfaces):**
   - Cards, sidebars, panes, menus, descriptions, and statistics boxes must use solid pure-white (`#ffffff` / `var(--a-color-bg)`).
   - Eradicate `var(--a-color-surface)` as surface background in `.inbox-category-pane`, `.stats-card`, `.vd-description`, `.vd-timestamp-hint`, `.vh-recommendation-menu`, and `.video-queue-select`.
   - Card hovers remain pure-white; hover feedback is driven by border transitions (`var(--a-color-border)`) rather than background tinting.

2. **R2 柔和分界 (Soft Dividers):**
   - Card borders use `var(--a-color-border)` (`#cbd5e1`).
   - Internal row dividing lines, progress tracks, and skeleton dividers use `var(--a-color-border-soft)` (`#e2e8f0`).
   - Eradicate `rgba(0,0,0,x)` or hardcoded divider colors.

3. **R3 阴影收敛 (Tokenized / Minimal Shadows):**
   - Eradicate hardcoded `0 4px 16px rgba(0,0,0,0.4)` and `0 8px 24px rgba(0,0,0,0.4)` in `VideoPlayerControls.vue`.
   - Control popovers and tooltips use `var(--a-shadow-md)` and crisp token borders.

4. **R4 4px 紧凑圆角 (4px Controlled Radius):**
   - All chips, badges, menus, popovers, and previews must use `var(--a-radius-control)` (4px) or `var(--a-radius-card)` (4px).
   - Eradicate `999px` pill radius on `.vh-chip` filter chips in `VideoHomeView.vue`.
   - Eradicate non-standard `6px` / `8px` in `VideoPlayerControls.vue` and `3px` in `VideoDetailView.vue`.

5. **R5 克制字重 (Restrained Typography):**
   - Section titles, stream headers, and playlist headings strictly `font-weight: 500`.
   - Eradicate `font-weight: 650` across `FeedRecommendedView.vue`, `VideoCollectionPlaylist.vue`, `VideoRecommendationRow.vue`.
   - Eradicate `font-weight: 700` in Chart.js tick configurations (`FeedStatsView.vue`).
   - Active filters and emphasis elements use `600`.
   - Numerical indicators and durations use `font-variant-numeric: tabular-nums`.

6. **R6 & R10 语义色彩令牌 (Semantic Color Tokens):**
   - Error and danger indicators strictly use `var(--a-color-danger)`.
   - Unread and success states use `var(--a-color-success)`.
   - Hot tags and badges use `var(--a-color-warning)`.
   - Eradicate fallback `#3b82f6` in `var(--a-color-primary, #3b82f6)`.

7. **R7 & R9 原生控件升级与契约对齐 (Component Contracts):**
   - Unauthenticated empty state actions strictly use `<PButton to="/login" variant="primary">`.
   - Retry actions use `PButton`.
   - Native select elements in `VideoFavoritesView.vue` and `FeedStarredView.vue` styled cleanly with token borders and backgrounds.

8. **R8 用户视角文案与去技术化 (User-Facing Copy):**
   - Eradicate database / developer jargon:
     - In `VideoDetailView.vue`: change "复制 UUID" / "UUID 已复制" to "复制视频 ID" / "视频 ID 已复制".
   - Maintain user-facing action text: "取消稍后阅读" (never "移除稍后阅读").

---

## 2. Module Component Breakdown

### 2.1 Video Module
- `src/components/video/VideoPlayerControls.vue`:
  - Replace hardcoded black shadows with `var(--a-shadow-md)` / crisp token borders.
  - Standardize `.vpc-preview` and `.vpc-speed-menu` to `border-radius: var(--a-radius-control)` (4px).
  - Update `.vpc-speed-option--active` font-weight from 700 to 600.
  - Standardize muted volume icon to `var(--a-color-danger)`.
  - Remove fallback `#3b82f6` on `var(--a-color-primary)`.
- `src/components/video/VideoCollectionPlaylist.vue`:
  - Change `.vcp__title` font-weight from 650 to 500.
  - Change `.vcp__item-title` font-weight from 550 to 500.
- `src/components/video/VideoRecommendationRow.vue`:
  - Change `.vrr__header h2` font-weight from 650 to 500.
- `src/views/video/VideoHomeView.vue`:
  - Change `.vh-chip` border-radius from `var(--a-radius-pill, 999px)` to `var(--a-radius-control)` (4px).
  - Change `.vh-chip` inactive font-weight from 600 to 500.
  - Change `.vh-recommendation-menu` background from `var(--a-color-surface)` to `var(--a-color-bg)` with 4px card radius.
- `src/views/video/VideoDetailView.vue`:
  - Change "复制 UUID" / "UUID 已复制" to "复制视频 ID" / "视频 ID 已复制" and sync test assertions.
  - Change `.vd-title` font-weight from 600 to 500.
  - Change `.vd-author-avatar` font-weight from 650 to 600.
  - Change `.vd-subscribe` and `.vd-comment-action` border-radius from 3px to `var(--a-radius-control)` (4px).
  - Change `.vd-description` and `.vd-timestamp-hint` backgrounds from `var(--a-color-surface)` to `var(--a-color-bg)`.
- `src/views/video/VideoEditorView.vue`:
  - Change `.ve-section-title` and `.ve-field-label` font-weights from 600 to 500.
- `src/views/video/VideoFavoritesView.vue`:
  - Change select and select-box backgrounds from `var(--a-color-surface)` to `var(--a-color-bg)`.
- `src/views/video/VideoSubscriptionsView.vue`:
  - Upgrade retry button to `PButton`.

### 2.2 Feed Module
- `src/views/feed/FeedRecommendedView.vue`:
  - Change `.stream-column__title-group h2` font-weight from 650 to 500.
  - Change `.topic-pill` font-weight from 550 to 500.
  - Change `.section-badge` font-weight from 650 to 500.
  - Change `.section-badge--hot` to use semantic token `var(--a-color-warning)`.
- `src/views/feed/FeedStarredView.vue`:
  - Upgrade unauthenticated login action to `PButton`.
  - Change `.star-group-button.active` font-weight from 650 to 600.
  - Standardize `star-group-select` border-radius and background to design tokens.
- `src/views/feed/FeedStatsView.vue`:
  - Change `.stats-card` background from `var(--a-color-surface)` to `var(--a-color-bg)`.
  - Remove gray background on hover to preserve pure-white surface.
  - Change Chart.js tick weights from 700 to 500.
- `src/views/feed/InboxPage.vue`:
  - Change `.inbox-category-pane` background from `var(--a-color-surface)` to `var(--a-color-bg)`.

---

## 3. Verification & Acceptance Criteria

1. **Type Checking:** `bun run type-check` passes with 0 errors.
2. **Unit & Contract Testing:**
   - All 33 test files in `tests/unit/views/feed`, `tests/unit/views/video`, `tests/unit/components/video`, `tests/unit/components/feed` pass cleanly (322+ tests).
   - Design system contracts in `tests/unit/ui/design-system-contract.spec.ts` pass.
3. **Format Integrity:** `git diff --check` passes with 0 warnings.
