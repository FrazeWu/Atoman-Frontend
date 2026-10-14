# Notification Module Polish & In-Place Stream Implementation Plan

**Spec Reference:** `docs/superpowers/specs/2026-10-14-notification-module-polish-design.md`  
**Target:** Atoman-Frontend

---

### Task 1: In-Place Accordion Expansion & Type Differentiation in `NotificationItemCard.vue`

**Files:**
- Modify: `src/components/notification/NotificationItemCard.vue`
- Modify: `src/components/notification/NotificationContextQuote.vue` (support clamp lines prop or expanded mode)
- Test: `tests/unit/components/notification/NotificationItemCard.spec.ts`

**Steps:**
1. Update `NotificationContextQuote.vue` to accept `clampLines?: number` prop (default `2`, collapsible to `1` or `0` for none).
2. In `NotificationItemCard.vue`:
   - Add `expanded?: boolean` prop and internal `isExpanded = ref(props.expanded ?? false)` state with toggle handler `toggleExpand()`.
   - Add `IconChevronDown` on the top right to indicate expansion state, rotating 180° when expanded.
   - When collapsed, hide heavy actions row and show 1-line quote preview.
   - When expanded, show full multi-line quote, full formatted date/time, and the actions row (`前往来源内容` / `前往处理`, `已读`, `更多操作`).
   - Add `.notification-item-card--system` class with `border-left: 3px solid var(--a-color-primary)`.
   - When system notification has no actor avatar, render a system broadcast/shield icon.
   - For collaboration notifications, render "待处理" badge and label primary button as "前往处理".
3. Update `NotificationItemCard.spec.ts`:
   - Test toggle expansion on card click.
   - Test system left border and collaboration "前往处理" button text.
   - Test keyboard `Enter` / `Space` expand/collapse.
4. Run tests: `bun run test:unit tests/unit/components/notification/`
5. Commit: `feat(notification): add in-place accordion expansion and type differentiation to NotificationItemCard`

---

### Task 2: Layout Width Constraints & Stream Polishing in `InboxPage.vue`

**Files:**
- Modify: `src/views/feed/InboxPage.vue`
- Test: `tests/unit/views/feed/InboxPage.notifications.spec.ts`
- Test: `tests/unit/views/feed/InboxPage.spec.ts`
- Test: `tests/unit/views/feed/InboxPage.forum-routing.spec.ts`

**Steps:**
1. In `InboxPage.vue`:
   - Constrain stream workspace with `.stream-workspace-container` max-width `780px` and responsive auto margins.
   - Refine toolbar category badge with `color-mix(in srgb, var(--a-color-primary) 12%, transparent)`.
   - Ensure `<NotificationItemCard>` maintains backward compatibility with `.sidebar-item`, `.sidebar-item-source`, `.detail-actions button`, `.stream-card`.
2. Run tests: `bun run test:unit tests/unit/views/feed/InboxPage*`
3. Commit: `refactor(inbox): constrain stream width and polish notification feed layout`

---

### Task 3: Topbar Popover Freshness & Micro-Interactions in `NotificationPopover.vue`

**Files:**
- Modify: `src/components/system/NotificationPopover.vue`
- Test: `tests/unit/components/system/NotificationPopover.spec.ts`

**Steps:**
1. In `NotificationPopover.vue`:
   - Trigger `notificationStore.fetchNotifications('all')` on every mount / open event to guarantee fresh data.
   - Enhance empty state with icon (`IconInbox` / `IconBellOff`) and clean copy ("所有通知已读完").
   - Add hover micro-motion arrow on footer navigation links.
2. Run tests: `bun run test:unit tests/unit/components/system/NotificationPopover.spec.ts`
3. Commit: `feat(notification): add auto-sync and polish empty state in NotificationPopover`

---

### Task 4: Whole-Module Integration Verification & Remote Push

**Steps:**
1. Run full unit and contract test suite:
   - `bun run test:unit tests/unit/components/notification/ tests/unit/components/system/NotificationPopover.spec.ts tests/unit/components/AppTopbarAuthControls.spec.ts tests/unit/utils/notificationHelpers.spec.ts tests/unit/views/feed/InboxPage.notifications.spec.ts tests/unit/views/feed/InboxPage.forum-routing.spec.ts tests/unit/views/feed/InboxPage.spec.ts tests/unit/ui/design-system-contract.spec.ts`
2. Run TypeScript type check: `bun run type-check`
3. Run production build: `bun run build`
4. Check git diff and commit history.
5. Push to `origin/main`: `git push origin main`
