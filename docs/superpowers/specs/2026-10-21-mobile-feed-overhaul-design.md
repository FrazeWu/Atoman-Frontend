# Mobile Feed Space Overhaul Spec (Option B: 轻快社交信息流型)

## Overview
Overhaul the mobile Feed (RSS) module in `Atoman-Frontend` into a 4-tab lightweight social-information stream adhering to the Pure-White Minimal Design System (4px radius, `#ffffff` surfaces, soft borders, 500/600 font weights, no 999px pills, no dev jargon).

## Bottom Navigation Tabs
1. **Tab 1: 精选 (`/feed`)** - `FeedStreamView.vue`
   - Hero/Recommended feed stream with AI summary highlights, hot topics, clean article cards (author avatar, source, title, summary, likes, comments, bookmark).
2. **Tab 2: 关注 (`/feed/following`)** - `FeedFollowingView.vue`
   - Pure chronological timeline of followed sources, sources quick-filter row, "全部已读" action, and direct link to source management (`/feed/sources`).
3. **Tab 3: 收藏 (`/feed/starred`)** - `FeedStarredView.vue`
   - Bookmarked / saved articles library with category chips, tap to read, and unbookmark action.
4. **Tab 4: 我的 (`/feed/me`)** - `FeedMeView.vue`
   - Feed reader profile, 4 stats (关注源, 收藏文章, 已读文章, 阅读时长), shortcut to subscription management, OPML import/export placeholder.

## Article Reading Experience
- `/feed/article/:id` (`FeedArticleReaderView.vue`): Fullscreen distraction-free reader with sticky `< 返回` topbar, reading font size control, bookmark toggle, and share action.
