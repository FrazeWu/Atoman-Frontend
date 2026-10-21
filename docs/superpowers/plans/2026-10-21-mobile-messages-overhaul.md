# Mobile Messages Space Overhaul Plan

## Tasks

- [ ] Task 1: Navigation Shell Tabs & Routes Configuration
  - Update `apps/mobile/components/system/spaceConstants.ts` for `SPACE_TABS.messages` to:
    - `[私信 (/inbox), 通知 (/inbox/notifications), 联系人 (/inbox/contacts), 设置 (/inbox/me)]`
  - Update `apps/mobile/mobileRouteMeta.ts` to add `/^\/(?:inbox|messages)\/chat\//` to `mobileDetailPatterns`
  - Update `tests/unit/mobile/navigation-shell.spec.ts` assertion for messages tabs
  - Register `/inbox/notifications`, `/inbox/contacts`, `/inbox/me`, `/inbox/chat/:id` in `apps/mobile/mobileRoutes.ts`

- [ ] Task 2: Implement Unit Tests
  - Create `tests/unit/mobile/messages-space.spec.ts` covering:
    - `MessagesConversationsView.vue`
    - `MessagesNotificationsView.vue`
    - `MessagesContactsView.vue`
    - `MessagesMeView.vue`
    - `MessageChatMobileView.vue`

- [ ] Task 3: Implement `MessageChatMobileView.vue`
  - Sticky topbar with `< 返回`, contact name & avatar
  - Telegram style bubbles (Option A tint for me, white for other, inner time & tick)
  - Bottom input composer with enter-to-send

- [ ] Task 4: Upgrade `MessagesMobileView.vue` / Implement `MessagesConversationsView.vue`
  - Contact search, unread badge, navigation to `/inbox/chat/:id`, fallback sample conversations

- [ ] Task 5: Implement `MessagesNotificationsView.vue`
  - Category filter chips, mark-all-read action, notification cards stream

- [ ] Task 6: Implement `MessagesContactsView.vue` & `MessagesMeView.vue`
  - Contacts list with instant chat launch
  - Settings panel with DND toggle, permission radios, blacklist count

- [ ] Task 7: Verification & Visual Capture
  - Run `bun run test:unit tests/unit/mobile/messages-space.spec.ts`
  - Run all mobile unit tests and `bun run type-check`
  - Capture screenshots of all 5 views
  - Git commit and push to remote
