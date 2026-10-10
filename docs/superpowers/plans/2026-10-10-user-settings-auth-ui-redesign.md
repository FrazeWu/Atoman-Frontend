# Implementation Plan: User, Settings & Auth UI Redesign (Pure-White Double-Notch Minimal System)

## Proposed Changes

Migrate views and components in `src/views/auth/`, `src/components/auth/`, `src/views/user/`, `src/components/user/`, `src/views/setting/`, and `src/components/setting/` to the Pure-White Double-Notch Minimal System.

---

### Task 1: Auth Views & Styles Polish (`src/views/auth/*`, `src/components/auth/*`)

**Files:**
- Modify: `src/views/auth/oauth-flow.css`
- Modify: `src/views/auth/LoginView.vue`
- Modify: `src/views/auth/ForgotPasswordView.vue`
- Modify: `src/components/auth/OAuthProviderButtons.vue`

- [ ] **Step 1: Polish oauth-flow.css**
  - Change `.oauth-flow-page` background to solid `var(--a-color-bg)` (remove surface color and grid texture).
  - Change `.oauth-flow-card h1` font-weight from `600` to `500`.
- [ ] **Step 2: Polish LoginView.vue**
  - Change `.auth-page` background to solid `var(--a-color-bg)` (remove surface color and grid texture).
  - Change `.auth-title` font-weight from `600` to `500`.
  - Clamp strong font-weights: `.auth-kicker` and `.step-label` from `700` to `600`; `.email-field-label` and `.auth-code-btn-inline` from `800` to `600`.
  - Normalize radii: `.step-dot` and `.email-field-dot` from `50%`/`999px` to `var(--a-radius-control)`.
  - Replace hardcoded `#fff` and secondary tokens with `var(--a-color-bg)` and `var(--a-color-danger)`.
- [ ] **Step 3: Polish ForgotPasswordView.vue**
  - Change `.auth-page` background to solid `var(--a-color-bg)` (remove surface color and grid texture).
  - Change `.auth-title` font-weight from `600` to `500`.
  - Clamp font-weights from `700`/`800` to `600`.
  - Normalize radii: `.step-dot` from `50%` to `var(--a-radius-control)`.
  - Replace hardcoded `#fff` and secondary tokens.
- [ ] **Step 4: Polish OAuthProviderButtons.vue**
  - Change `.oauth-providers__last-used` border-radius from `999px` to `var(--a-radius-control)` (4px), font-weight from `700` to `600`.
- [ ] **Step 5: Verify & Commit**
  - Run `bun run type-check`.
  - Commit: `refactor(auth): standardize auth pages, background surfaces, typography, and badges`

---

### Task 2: User Profile & Settings Panels Polish (`src/views/user/*`, `src/components/user/*`)

**Files:**
- Modify: `src/views/user/MyHubView.vue`
- Modify: `src/views/user/UserSettingsView.vue`
- Modify: `src/components/user/AccountSecurityPanel.vue`
- Modify: `src/components/user/NotificationSettingsPanel.vue`
- Modify: `src/components/user/PrivacySettingsPanel.vue`
- Modify: `src/components/user/UserSummaryCard.vue`
- Modify: `src/components/user/UserBlogSettingsPanel.vue`
- Modify: `src/components/user/BlockedUsersSettingsPanel.vue`

- [ ] **Step 1: Polish MyHubView.vue**
  - Change `h1` font-weight from `600` to `500`.
  - Upgrade `.a-btn` router links to `PButton`.
  - Standardize `.my-hub__shortcut-badge` radius from `999px` to `var(--a-radius-control)`.
  - Replace developer-facing eyebrow `MY ATOMAN` with natural Chinese.
- [ ] **Step 2: Polish UserSettingsView.vue**
  - Localize section kickers (remove English uppercase `01 / PROFILE`, `DANGER ZONE`, etc.).
  - Fix hyphenated title `title="目录-账号设置"` -> `title="账号设置目录"`.
  - Standardize `var(--a-color-accent-destructive)` to `var(--a-color-danger)`.
- [ ] **Step 3: Polish AccountSecurityPanel.vue & BlockedUsersSettingsPanel.vue**
  - Replace undefined `var(--a-color-accent)` with `var(--a-color-primary)`.
  - Change `.session-item` and `.activity-item` surface to pure-white `var(--a-color-bg)` with `var(--a-color-border-soft)`.
  - Replace `border-radius: 3px` with `var(--a-radius-control)`.
  - Replace `var(--a-color-accent-destructive)` with `var(--a-color-danger)`.
- [ ] **Step 4: Polish NotificationSettingsPanel.vue & PrivacySettingsPanel.vue**
  - Replace undefined `var(--a-color-accent-success)` with `var(--a-color-success)`.
  - Standardize custom switches: change `999px` / `50%` to `var(--a-radius-control)` (4px), remove raw `rgb()` box shadows.
  - Replace hardcoded `#fff` with `var(--a-color-bg)`.
- [ ] **Step 5: Polish UserSummaryCard.vue & UserBlogSettingsPanel.vue**
  - Replace `#b45309` with `var(--a-color-warning)`.
  - Clamp font-weights from `700` to `600`, section titles to `500`.
  - Standardize avatar preview radius from `6px` to `var(--a-radius-control)`.
- [ ] **Step 6: Verify & Commit**
  - Run `bun run type-check`.
  - Commit: `refactor(user): standardize user hub, settings panels, switches, and tokens`

---

### Task 3: Setting Management Views & Panels Polish (`src/views/setting/*`, `src/components/setting/*`)

**Files:**
- Modify: `src/views/setting/SettingAccessView.vue`
- Modify: `src/views/setting/SettingAnnouncementsView.vue`
- Modify: `src/views/setting/SettingCommunityView.vue`
- Modify: `src/components/setting/SettingManagementOverview.vue`
- Modify: `src/components/setting/SettingCommentReportsPanel.vue`
- Modify: `src/components/setting/SettingMusicReviewPanel.vue`
- Modify: `src/components/setting/SettingRolesPanel.vue`
- Modify: `src/components/setting/SettingFeedSourcePanel.vue`
- Modify: `src/components/setting/SettingFeedSourceItemsSheet.vue`
- Modify: `src/components/setting/SettingForumGroupPanel.vue`
- Modify: `src/components/setting/SettingForumUserModerationPanel.vue`
- Modify: `src/components/setting/SettingForumModeratorPanel.vue`

- [ ] **Step 1: Polish SettingAccessView.vue & SettingManagementOverview.vue**
  - Change `.setting-access__module-card` and `.setting-access__detail-directory` background from `var(--a-color-surface)` to `var(--a-color-bg)`.
  - Localize English kickers (`SITE ACCESS`, `MODULE MANAGEMENT`, `/{{ key.toUpperCase() }}`).
  - Standardize switch radii from `999px` to `var(--a-radius-control)`, remove raw drop shadow.
  - Standardize font-weights: clamp `650` to `600`, headings to `500`.
- [ ] **Step 2: Polish SettingAnnouncementsView.vue & SettingCommunityView.vue**
  - Change `.setting-announcements__preview` background from `var(--a-color-surface)` to `var(--a-color-bg)`.
  - Localize English kickers (`SITE ANNOUNCEMENTS`).
  - Standardize table headers and titles to `font-weight: 500`.
- [ ] **Step 3: Polish SettingMusicReviewPanel.vue & SettingCommentReportsPanel.vue**
  - In `SettingMusicReviewPanel.vue`: replace non-token hex colors (`#166534`, `#b45309`, `#991b1b`, `#f9fafb`) with semantic tokens (`var(--a-color-blog)`, `var(--a-color-warning)`, `var(--a-color-danger)`, `var(--a-color-surface-muted)`).
  - De-jargonize copy: replace `"处理理由"` with `"填写原因"`.
  - Remove forced uppercase; upgrade buttons to `PButton`.
  - In `SettingCommentReportsPanel.vue`: update select background to `var(--a-color-bg)`.
- [ ] **Step 4: Polish SettingFeedSourcePanel.vue, SettingFeedSourceItemsSheet.vue & Forum Panels**
  - Change `.forum-group-panel__group.is-active` background to `var(--a-color-bg)`.
  - Standardize sheet title: `"订阅源-条目"` -> `"订阅源条目"`.
  - Enforce `font-weight: 500` across section headings and panels.
- [ ] **Step 5: Verify & Commit**
  - Run `bun run type-check`.
  - Commit: `refactor(setting): standardize setting management views, panels, tokens, and surfaces`

---

### Task 4: Whole-Module Integration, Full Test Suite & Branch Review

**Files:**
- All modified files
- Unit & contract tests: `tests/unit/ui/design-system-contract.spec.ts`

- [ ] **Step 1: Run full type check**
  ```bash
  bun run type-check
  ```
- [ ] **Step 2: Run all unit & contract test suites**
  ```bash
  bun run test:unit tests/unit/ui/design-system-contract.spec.ts tests/unit/components/AppTopbar.auth-loading.spec.ts tests/unit/stores/auth.spec.ts tests/unit/stores/userBlocks.spec.ts
  ```
- [ ] **Step 3: Run git diff format check**
  ```bash
  git diff --check
  ```
- [ ] **Step 4: Dispatch whole-branch code review subagent**
- [ ] **Step 5: Merge into main and push to origin**
