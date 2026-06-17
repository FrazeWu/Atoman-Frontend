# Borderless White UI Redesign

## Goal

Redesign the frontend visual system to remove hard page-level dividing lines while preserving the current Atoman information architecture. The result should feel lighter and closer to YouTube's borderless white layout: structure comes from spacing, typography, hover states, and content grouping, not from borders between the topbar, sidebar, and content area.

## Design Principles

- Keep all major surfaces pure white: app background, topbar, sidebar, content area, cards, and sheets.
- Remove hard structural separators such as topbar bottom borders, sidebar right borders, card boxes, list row borders, and page-section divider lines.
- Do not significantly change the existing content area structure or module sidebar structure.
- Preserve Atoman's paper/action identity through typography, spacing, shadows, and existing primary action treatments.
- Use hover and active states to clarify interaction instead of permanent divider lines.
- Do not use hover movement. Hover states may change background, shadow, text weight, or color, but elements must not translate or shift.

## Scope

Primary shared surfaces:

- `src/components/AppTopbar.vue`
- `src/components/ui/PaperSidebar.vue`
- `src/components/ui/PaperSidebarItem.vue`
- Global layout styles around `.app-shell`, `.app-main`, `.a-module-layout`, `.a-main-content`, and related shared classes.
- Shared A*/Paper* primitives that currently rely on hard borders for non-action layout separation.

Representative module layouts and pages should inherit most of the redesign through shared components. Page-specific edits should be limited to places that define their own obvious structural `border`, `border-bottom`, `border-right`, divider, or boxed-card treatment.

Out of scope:

- Replacing current sidebars with a YouTube subscription-style sidebar.
- Rebuilding content areas into a YouTube video grid.
- Changing route structure, module information architecture, store logic, API integration, or page data flow.
- Removing hard shadows from primary actions where they communicate pressable controls.

## Topbar

The topbar remains sticky and white. Remove its bottom border and avoid adding a replacement divider. Navigation hierarchy should come from item styling:

- Default nav items: white background, muted text, enough spacing.
- Hover nav items: shallow gray background or subtle shadow, no movement.
- Active nav item: stronger text weight, dark text, optional soft gray pill or shallow shadow.
- Auth layout topbar follows the same borderless rule.

The brand area and auth controls keep their current structure unless small spacing adjustments are needed after removing borders.

## Sidebar

Sidebars keep their current `PaperSidebar` / `PaperSidebarItem` structure and module nav contents. Remove permanent structural divider lines and avoid full boxed item borders.

Sidebar item states:

- Default: white background, readable label hierarchy, no enclosing border.
- Hover: shallow gray background or soft shadow block, no movement.
- Active/focused: clearer gray background, stronger text weight, optional existing inset or shadow treatment if it does not read as a structural divider.
- Collapsed sidebar behavior should remain intact.

## Content Areas

Content pages should retain their current organization. The redesign changes visual separation, not layout meaning.

- Replace hard card/list borders with spacing, subtle shadows, typography, or hover-only emphasis.
- Default list and card items should stay quiet on a white background.
- Hover can show a soft shadow block or shallow gray background.
- Selected or active content may use a stronger shadow block when needed.
- Avoid page-section divider lines unless the line represents an input affordance, not structural separation.

## Forms and Actions

Inputs and controls are treated differently from layout separators:

- `PaperField` bottom-line manuscript styling can remain because it communicates input affordance.
- Primary actions such as publish, save, confirm, and other pressable controls may keep Atoman's hard shadow button style.
- Destructive actions may keep stronger visual treatment if needed for safety.
- Secondary text actions should prefer text, hover underline, soft background, or subtle shadow over boxed borders.

## Interaction Rules

- No hover translation or layout shift.
- No hover-only content reflow that changes surrounding item positions.
- Hover feedback may use background, box-shadow, text color, font weight, or underline.
- Active state must be visible without relying on a border line.
- Keyboard focus must remain visible after removing borders.

## Verification

Before calling implementation complete:

1. Run `bun run type-check`.
2. Check representative pages in a browser:
   - A sidebar-heavy Feed page.
   - A Forum or Music content page.
   - An auth/login layout.
3. Confirm these visual requirements:
   - Major surfaces remain white.
   - Topbar, sidebar, and content area no longer rely on permanent hard divider lines.
   - Existing page structure is recognizable.
   - Hover and active states are clear.
   - Hover does not move elements.
   - Mobile layout still communicates navigation hierarchy.
