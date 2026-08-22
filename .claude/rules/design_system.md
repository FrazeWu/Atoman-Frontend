# Design System

## Sheet and Drawer Design Spec
- All sheets and drawers (`PSheet.vue`) must use a solid white background:
  ```css
  background: #ffffff;
  ```
- Do not use backdrop blur or semi-transparent background color-mixing for sheets and drawers.

## Overlay and Route Layering
- The complete contract for sheets, drawers, modals, player layering, sidebars, stacks, and route-driven overlays is in `.claude/rules/overlay-layering.md`.
- Read that contract before changing any page-level overlay or Studio route.
