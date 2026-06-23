# Global Components Dual-Accent & Flat-Paper Design Spec

## Goal
Migrate all shared global UI components in `src/components/ui/` and global stylesheets in `src/style.css` to the brand's dual-accent color scheme (Postman Green `#0D9488` for confirmations/active states, and Vermilion Orange `#EA580C` for deletes/destructive states) and ensure strict alignment with the flat-paper, straight-edge design language.

## Scope
- Modify `src/style.css`
- Modify `src/components/ui/PButton.vue`
- Modify `src/components/ui/PSheetTab.vue`
- Modify `src/components/ui/PDiscussionFAB.vue`
- Modify `src/components/ui/PInput.vue`
- Modify `src/components/ui/PTextarea.vue`
- Modify `src/components/ui/PSelect.vue`
- Modify `src/components/ui/PChoiceField.vue`
- Modify `src/components/ui/PCountryRegionField.vue`
- Modify `src/components/ui/PEntry.vue`

## Key Specifications

### 1. Global CSS Styles (`src/style.css`)
- **Secondary Actions Hover**:
  Modify `.paper-action:hover:not(.paper-action--primary):not(:disabled)` so it highlights with `background: var(--a-color-accent-confirm) !important` and `color: var(--a-color-paper) !important`.

### 2. Buttons & Close Tabs Hover Updates
- **`PButton.vue`** (Secondary Variant Hover):
  Update `.p-button--secondary:hover:not(.p-button--disabled)` to:
  - `background: var(--a-color-accent-confirm)`
  - `color: var(--a-color-paper)`
  - `border-bottom-color: var(--a-color-accent-confirm)`
- **`PSheetTab.vue`** (Close Sheet Tab Hover):
  Since this tab represents sheet closing, style `.sheet-tab:hover` with:
  - `background-color: var(--a-color-accent-destructive)`
  - `color: var(--a-color-paper)`
  - `border-color: var(--a-color-accent-destructive)`
- **`PDiscussionFAB.vue`** (Discussion Floating Button Hover):
  Update `.discussion-fab:hover` to use:
  - `background: var(--a-color-accent-confirm)`
  - `border-color: var(--a-color-accent-confirm)`

### 3. Focus & Option Selection Updates
- **`PInput.vue` / `PTextarea.vue`** (Fields Focus & Error States):
  - Focus underline: Modify `.p-input:focus` and `.p-textarea:focus` to set `border-bottom-color: var(--a-color-accent-confirm)`.
  - Error state underline: Modify `.p-input--error` and `.p-textarea--error` to set `border-bottom-color: var(--a-color-accent-destructive)`.
  - Error message text: Set `.p-field-error` color to `var(--a-color-accent-destructive)`.
- **`PSelect.vue`** (Select Input):
  - Focus/open state: Update `.p-select-trigger:focus-visible` and `.p-select-trigger--open` to set `border-bottom-color: var(--a-color-accent-confirm)`.
  - Error state: Set `.p-select-trigger--error` to `border-bottom-color: var(--a-color-accent-destructive)` and `.p-field-error` to `color: var(--a-color-accent-destructive)`.
  - Selected indicator: Modify `.p-select-marker` to use `color: var(--a-color-accent-confirm)`.
- **`PChoiceField.vue`** (Choice Input):
  - Focus/open state: Set `.paper-choice-trigger:focus-visible` and `.paper-choice--open .paper-choice-trigger` to set `border-bottom-color: var(--a-color-accent-confirm)`.
  - Active indicator: Update `.paper-choice-option--active` text and `.paper-choice-marker` color to `var(--a-color-accent-confirm)`.
- **`PCountryRegionField.vue`** (Region Dropdown):
  - Focus/open state: Set `.paper-field-trigger:hover`, `.paper-field-trigger:focus-visible`, and `.paper-field--open .paper-field-trigger` to set `border-bottom-color: var(--a-color-accent-confirm)`.
  - Active option: Update `.paper-field-option:hover`, `.paper-field-option--active` text, and `.paper-field-option-marker` color to `var(--a-color-accent-confirm)`.
  - Panel styling: Change `.paper-field-panel` to use straight edges (`border-radius: 0px`), flat-paper border (`border: 1px solid var(--a-color-line-soft)`), and hard drop-shadow (`box-shadow: 3px 3px 0px rgba(0, 0, 0, 0.15)`) to align with design specs.

### 4. Card & Feed Entries (`PEntry.vue`)
- **Flat Border Radius**: Change `.p-entry` style `border-radius: 8px` to `border-radius: var(--a-radius-none, 0px)`.
- **Active State Outline**: Update `.p-entry.is-open` box-shadow to `box-shadow: inset -4px 0 0 var(--a-color-accent-confirm)`.
- **Focused Border**: Update `.p-entry.is-focused` left border color to `border-left-color: var(--a-color-accent-confirm)`.

## Verification Criteria
1. Compile frontend code using `bun run build`.
2. Run frontend unit tests using `bun run test:unit`. All tests must pass.
