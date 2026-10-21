# Mobile Blog Space Overhaul Design Spec

**Date**: 2026-10-21  
**Status**: Approved  
**Scope**: `apps/mobile/` Blog space navigation, views, detail reader, and mobile author profile.

---

## 1. Overview & Objective

Following the user-approved structure, the mobile Blog space is overhauled into four dedicated tabs:
1. **发现** (`/posts`): Exploration hub featuring search, today's top curated story, trending topics/channels, and recommended articles & notes.
2. **短笺** (`/posts/notes`): Streamlined timeline of short thoughts (micro-notes / 即刻风格短动态), with quick likes, comments, and a frictionless mobile composer sheet.
3. **长文** (`/posts/articles`): Dedicated deep-reading section with topic tag filters, article cards with estimated reading times, and rich reading details.
4. **我的** (`/posts/me`): Scoped blog profile displaying creator stats (短笺、长文、获赞、关注), user's published notes & posts, and saved bookmarks/favorites.

### Design System Adherence
- **Surface**: Pure white (`#ffffff` / `var(--a-color-bg)`).
- **Radius**: 4px micro-radius (`var(--a-radius-card)`, `var(--a-radius-control)`), strictly no 999px pills.
- **Borders & Dividers**: Soft subtle borders (`var(--a-color-border-soft)` / `var(--a-color-border)`).
- **Typography**: 500 normal titles/names, 600 subtle emphasis, strictly no 700/800 bold.
- **Copy**: Clean user-facing text, strictly zero developer jargon.

---

## 2. Navigation & Routing Architecture

### Bottom Nav Definition (`apps/mobile/components/system/spaceConstants.ts`)
```ts
export const SPACE_TABS: Record<string, NavTabItem[]> = {
  // ...
  blog: [
    { key: 'discover', label: '发现', icon: 'compass', path: '/posts' },
    { key: 'notes', label: '短笺', icon: 'notes', path: '/posts/notes' },
    { key: 'articles', label: '长文', icon: 'file-text', path: '/posts/articles' },
    { key: 'me', label: '我的', icon: 'person', path: '/posts/me' },
  ],
  // ...
}
```

### Route Mappings (`apps/mobile/mobileRoutes.ts`)
- `/posts` -> `BlogDiscoverView.vue` (Tab 1: 发现)
- `/posts/notes` -> `BlogNotesTimelineView.vue` (Tab 2: 短笺)
- `/posts/articles` -> `BlogArticlesView.vue` (Tab 3: 长文)
- `/posts/me` -> `BlogMeView.vue` (Tab 4: 我的)
- `/post/:id` -> `BlogPostReaderView.vue` (长文详情阅读器，底部导航常驻)
- `/posts/notes/:id` -> `ShortNoteDetailMobileView.vue` (短笺详情，底部导航常驻)

### Navigation Bar Preservation (`apps/mobile/MobileApp.vue`)
Add regex whitelist so that entering longform posts or shortnote details keeps the bottom navigation bar active with a top `<` back button:
```ts
const allowBottomNavPatterns = [
  /^\/music\/(?:playlist|album)\//,
  /^\/post\//,
  /^\/posts\/notes\//,
]
```

---

## 3. View Specifications

### 3.1 Tab 1: 发现页 (`BlogDiscoverView.vue`)
- **Header & Search**:
  - Pure-white top header with `MInput` search box (`placeholder="搜索长文、短笺、专栏..."`).
  - Search filter chips: 全部、长文、短笺。
- **今日精选大卡片**:
  - Cover photo with subtle border.
  - Title, author avatar & name, reading time estimate, and "立即阅读" action.
- **热门专栏横滑区**:
  - Horizontal scroll cards with channel name, post count, and author.
- **推荐流**:
  - Mix of curated articles and trending shortnotes.

### 3.2 Tab 2: 短笺页 (`BlogNotesTimelineView.vue`)
- **Feed Stream**:
  - Author header: 4px avatar (`MAvatar`), author display name, publish time (e.g. "12分钟前", "昨天").
  - Content body: multiline text with auto-link and clean line-height.
  - Media preview: responsive image grid (1 to 9 pictures) or single image card.
  - Interaction row: like button with heart count, comment count, bookmark icon.
- **Floating / Sticky Compose Action**:
  - Floating action button or header icon to trigger `ShortNoteComposerSheet.vue`.
  - Bottom sheet with textarea, photo picker placeholder, and "发布短笺" button.

### 3.3 Tab 3: 长文页 (`BlogArticlesView.vue`)
- **Category Filter Chips**:
  - Horizontal chip bar: 全部、技术、思考、随笔、文化、设计。
- **Article Card List**:
  - 4px micro-rounded card with title, 2-line excerpt, tags (`#标签`), and footer row.
  - Footer row: author avatar, author name, reading time (e.g. `5 分钟`), published date.
  - Tap card pushes `/post/:id`.

### 3.4 Tab 4: 专属「我的」(`BlogMeView.vue`)
- **Author Identity Card**:
  - Avatar, display name, handle, bio.
  - Four-metric stats grid: 短笺数、长文数、获赞数、关注者。
- **Three Sub-tabs**:
  1. **短笺**: My posted short notes with delete/view actions.
  2. **长文**: My published articles & drafts.
  3. **收藏**: Saved bookmarks and favorites.
- Empty states with clean prompts and "去发现文章" / "发第一条短笺" actions.

---

## 4. Verification & Testing Plan
1. **Unit Tests**:
   - `tests/unit/mobile/blog-views.spec.ts`: Verify `BlogDiscoverView`, `BlogNotesTimelineView`, `BlogArticlesView`, `BlogMeView`, and detail navigation.
   - `tests/unit/mobile/navigation-shell.spec.ts`: Assert Blog tabs match `['发现', '短笺', '长文', '我的']`.
2. **Type Checking**:
   - `bun run type-check`: 0 errors.
3. **Visual Screenshots Walkthrough**:
   - Capture `/posts`, `/posts/notes`, `/posts/articles`, `/posts/me`, `/post/:id`.
   - Inspect visually against design tokens.
