# Mobile Messages Space Overhaul Spec (Option A: Telegram 风格即时通信与通知双轨并重)

## Overview
Overhaul the mobile Messages space in `Atoman-Frontend` into a 4-tab Telegram-inspired messaging and notifications center adhering to the Pure-White Minimal Design System (4px radius, `#ffffff` surfaces, soft borders, 500/600 font weights, no 999px pills, no dev jargon).

## Bottom Navigation Tabs
1. **Tab 1: 私信 (`/inbox`)** - `MessagesConversationsView.vue`
   - Search bar for contacts and message previews.
   - Conversation items: 4px micro-rounded avatar with monogram fallback, party name, relative time, preview, outgoing checkmark `✓` (`MIcon name="check"`), unread count badge.
   - Start new chat shortcut button.
   - Tap item navigates to full chat `/inbox/chat/:id`.
2. **Tab 2: 通知 (`/inbox/notifications`)** - `MessagesNotificationsView.vue`
   - Filter segmented chips: "全部", "回复", "点赞", "系统".
   - "全部已读" one-tap action.
   - Notification item: icon/avatar, title, context preview, timestamp, read status.
3. **Tab 3: 联系人 (`/inbox/contacts`)** - `MessagesContactsView.vue`
   - Search contacts input.
   - Followed contacts list with status indicator.
   - Direct "发消息" action button routing into `/inbox/chat/:id`.
4. **Tab 4: 设置 (`/inbox/me`)** - `MessagesMeView.vue`
   - Messaging status stats (未读消息, 未读通知, 黑名单人数).
   - "消息免打扰" toggle.
   - "私信权限" (所有人 / 仅关注).
   - "黑名单管理" and "清理未读与缓存".

## Fullscreen Chat View
- `/inbox/chat/:id` (`MessageChatMobileView.vue`):
  - Sticky header: `< 返回` button, contact avatar, contact name, online badge, right drawer action.
  - Message bubble stream conforming to Telegram Minimal Style:
    - Outgoing (me): subtle primary tint (`color-mix(in srgb, var(--a-color-primary) 10%, #ffffff)`), 4px border radius, inner micro-time + `✓` check.
    - Incoming (other): pure white `#ffffff`, soft border `var(--a-color-border-soft)`, inner micro-time.
  - Composer: input field, send button, enter-to-send with IME composition guard, image upload/paste.
