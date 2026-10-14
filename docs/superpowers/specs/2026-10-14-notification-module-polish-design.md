# Notification Module Polish & In-Place Stream Design Spec

**Date:** 2026-10-14  
**Author:** Antigravity  
**Status:** Approved by User  
**Target Module:** Atoman-Frontend (`src/components/notification/`, `src/components/system/`, `src/views/feed/`)

---

## 1. Problem Statement & Motivation

Following the initial pure-white overhaul of the notification module, several UX and layout friction points were identified:
1. **Wide-Screen Layout Disbalance:** On large desktop displays (1200px+), the single-stream notification cards stretched across the entire available container width, separating titles/avatars from timestamps and actions by 800px+ of empty space.
2. **Context-Jumping Disruption:** Clicking any notification card immediately navigates away to external routes (e.g. forum topic, song details), breaking the user's flow and making it tedious to review or clear multiple notifications in sequence.
3. **Card Visual Uniformity:** System alerts, collaboration todos, and social interactions (likes/replies) shared nearly identical card geometry, lacking immediate visual hierarchy for actionable tasks vs informational broadcasts.
4. **Topbar Popover Freshness:** The dropdown popover did not auto-refresh when opened repeatedly, occasionally presenting stale notifications until manual re-fetch.

---

## 2. Design Goals & System Alignment

Strict adherence to the **Pure-White Double-Notch Minimal System** (`docs/specs/2026-06-05-flat-paper-ui-design.md`, `design_system.md`, `AGENTS.md`):
- **Surfaces:** Pure-white `#ffffff` / `var(--a-color-bg)`.
- **Soft Dividers:** `var(--a-color-border-soft)` and `var(--a-color-border)`.
- **Geometry & Shadows:** `var(--a-radius-card)` (4px) and `var(--a-radius-control)` (4px); `var(--a-shadow-sm)` and `var(--a-shadow-dropdown)`.
- **Typography:** Strict font-weight `500` for titles and body, `600` for active/strong states.
- **Copy Cleanliness:** Zero developer jargon.

---

## 3. Detailed Architecture & Design Specifications

### 3.1 Layout & Width Constraints (`InboxPage.vue`)
- **Centered / Constrained Stream Workspace:**
  - Introduce `.stream-workspace-container` with `max-width: 780px` and responsive auto margins.
  - Ensures avatars, quotes, actions, and timestamps remain within an ergonomic scanning width.
- **Stream Toolbar Refinements:**
  - Active category label with badge indicator using subtle primary tint: `color-mix(in srgb, var(--a-color-primary) 12%, transparent)` with `var(--a-color-primary)`.
  - Filter toggle ("所有" vs "仅未读") segmented control with smooth transitions.

### 3.2 In-Place Accordion Expansion (`NotificationItemCard.vue`)
- **Card States:**
  - **Collapsed State (Default):**
    - Compact height (approx 72px ~ 80px).
    - Header line: avatar with badge, title, source label, relative time, and unread indicator dot.
    - Single-line clamped quote preview (`NotificationContextQuote.vue` with 1-line clamp in collapsed mode).
    - Chevron indicator (`IconChevronDown`) smoothly rotated 0° -> 180° upon expansion.
  - **Expanded State (On User Click):**
    - Card smoothly expands vertically (via CSS transition).
    - Full quotation block without truncation (complete multi-line excerpt or body).
    - Additional metadata strip: exact formatted time (e.g. `2026-10-14 16:32`) and source module tag.
    - Exposed action row: primary button ("前往来源内容" / "前往处理"), "标为已读" button, and more options menu.
    - Card boundary subtly highlighted with `var(--a-color-border)` and `var(--a-shadow-sm)`.
- **Keyboard Navigation:**
  - `Enter` or `Space` toggles the expanded/collapsed state.
  - Clicking inner interactive controls (buttons, links, menus) stops bubbling and does not collapse/expand the card unexpectedly.

### 3.3 Type Differentiation
- **System Notifications (`category === 'system'` or `site_announcement` / `feed_source_health`):**
  - Left accent border: `3px solid var(--a-color-primary)`.
  - System avatar fallback: renders broadcast/shield icon with muted background `var(--a-color-surface-muted)`.
- **Collaboration Notifications (`category === 'collaboration'` or `music_lyrics` / `content_published`):**
  - "待处理" status badge chip next to source label.
  - Primary action button text rendered as "前往处理".

### 3.4 Topbar Popover Enhancements (`NotificationPopover.vue`)
- **Auto-Sync on Open:**
  - In `onMounted` and whenever dropdown visibility toggles to open, trigger background sync `notificationStore.fetchNotifications('all')`.
- **Empty State & Footer:**
  - Enhanced empty state with clear icon and refined copy ("所有通知已读完").
  - Footer navigation items with subtle arrow hover micro-motion.

---

## 4. Test Strategy & Backward Compatibility

- **Existing Tests Compatibility:**
  - Must preserve `.sidebar-item`, `.sidebar-item-source`, `.detail-actions button`, `.stream-card`, `[data-test="action-jump"]`, and tab naming assertions.
  - Keep 8 established category tabs (`like`, `interaction`, `mention`, `reply`, `forum`, `collaboration`, `system`, `dm`).
- **New Test Coverage:**
  - Unit tests for card expansion/collapse toggle and Chevron rotation.
  - Unit tests for system card accent border and collaboration "前往处理" button label.
  - Popover auto-sync on mount/toggle.
