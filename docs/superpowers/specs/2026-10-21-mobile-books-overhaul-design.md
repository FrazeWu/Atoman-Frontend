# Mobile Books Space Overhaul Design Spec

**Date**: 2026-10-21  
**Status**: Approved (Option B: 知识沉淀与书摘型)  
**Scope**: `apps/mobile/` Books space navigation, views, book detail page, reading notes library, and mobile reader profile.

---

## 1. Overview & Objective

Following the user-approved Option B (知识沉淀与书摘型), the mobile Books space is overhauled into four dedicated tabs:
1. **发现** (`/books`): Exploration hub featuring search, today's top recommended book hero card, category chips (哲学/文学/社科/科技/历史), and ranked books list.
2. **书架** (`/books/shelf`): Personal bookshelf with prominent "当前在读" progress tracker card, shelf catalog, format badges, and local import action.
3. **书摘** (`/books/notes`): Dedicated reading highlights and notes archive, organized by book, with golden border highlight quotes, user commentary, and card sharing.
4. **我的** (`/books/me`): Reader personal center with reading stats (在读、已读、书摘数、阅读时长), annual reading target progress bar, and finished reading history.

### Book Detail Page Continuity
- Clicking any book in Discover or Shelf pushes to dedicated **`BookDetailMobileView.vue`** (`/books/work/:id`).
- The page presents book cover, title, author, publisher, rating, expandable synopsis, chapter previews, and primary actions ("加入书架", "开始阅读").
- **Bottom Navigation Bar is kept persistently visible** (matching Music playlist/album detail and Blog post/note detail).

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
  books: [
    { key: 'discover', label: '发现', icon: 'compass', path: '/books' },
    { key: 'shelf', label: '书架', icon: 'shelf', path: '/books/shelf' },
    { key: 'notes', label: '书摘', icon: 'notes', path: '/books/notes' },
    { key: 'me', label: '我的', icon: 'person', path: '/books/me' },
  ],
  // ...
}
```

### Route Mappings (`apps/mobile/mobileRoutes.ts`)
- `/books` -> `BooksDiscoverView.vue` (Tab 1: 发现)
- `/books/shelf` -> `BooksShelfView.vue` (Tab 2: 书架)
- `/books/notes` -> `BooksNotesView.vue` (Tab 3: 书摘)
- `/books/me` -> `BooksMeView.vue` (Tab 4: 我的)
- `/books/work/:id` -> `BookDetailMobileView.vue` (图书详情页，底部导航常驻)
- `/books/read/:id` -> `BookReaderMobileView.vue` / `@/views/books/BookReaderView.vue` (沉浸式阅读器)

### Navigation Bar Preservation (`apps/mobile/MobileApp.vue`)
Whitelist `/^\/books\/work\//` in `showMobileBottomNav`:
```ts
const showMobileBottomNav = computed(() => {
  if (isAuthRoute.value || isUtilityRoute.value || route.path === '/' || route.path === '/music/player') return false
  if (/^\/music\/(?:playlist|album)\//.test(route.path)) return true
  if (/^\/post\//.test(route.path) || /^\/posts\/notes\//.test(route.path)) return true
  if (/^\/books\/work\//.test(route.path)) return true
  return !isDetailRoute.value
})
```

---

## 3. View Specifications

### 3.1 Tab 1: 发现 (`BooksDiscoverView.vue`)
- **Header & Search**:
  - `MInput` with placeholder "搜索书名、作者或出版社...".
  - Quick category chips: 全部、高分榜、哲学、文学、科技、社科.
- **今日领读 Hero Card**:
  - 58x80 spine book cover.
  - Tag: "今日力荐".
  - Title, author, rating (`★ 9.4`), synopsis preview, "查看详情" button.
- **高分图书流**:
  - List of catalog books, each with cover, title, author, rating score, and tap-to-detail.

### 3.2 Tab 2: 书架 (`BooksShelfView.vue`)
- **"当前在读" Card**:
  - Book cover, title, author.
  - Reading progress (e.g. `已读 64% · 12 条划线批注`).
  - 3px progress bar fill.
  - "继续阅读" action button.
- **"书架图书" List**:
  - Multi-status filter: 全部 (count), 在读, 想读, 已读.
  - Book items with format badge (`EPUB`, `PDF`), file size, tap to detail.

### 3.3 Tab 3: 书摘 (`BooksNotesView.vue`)
- **Header**:
  - Title "书摘", subtitle "全书高亮与思想沉淀".
- **Notes Stream**:
  - Book title tag (e.g. `《沉思录》· 卷四`).
  - Highlighted quote block with subtle golden left border.
  - User's annotation / reflection note.
  - Date & action row (copy text, share quote, delete).
- **Empty State**:
  - Clean bookmark icon and guidance prompt.

### 3.4 Tab 4: 专属「我的」(`BooksMeView.vue`)
- **Reader Identity Card**:
  - Avatar, display name, handle, bio.
  - 4 stats: 在读 (count), 读过 (count), 书摘 (count), 阅读时长 (hours).
- **年度阅读目标卡片**:
  - Target: e.g. 20 本, read: 14 本, progress bar, encouraging badge.
- **Subtabs**:
  - 「在读书籍」
  - 「已读书单」
  - 「我的书架设置」

---

## 4. Verification & Testing Plan
1. **Unit Tests**:
   - `tests/unit/mobile/books-space.spec.ts`: Test `BooksDiscoverView`, `BooksShelfView`, `BooksNotesView`, `BooksMeView`, and `BookDetailMobileView`.
   - `tests/unit/mobile/navigation-shell.spec.ts`: Assert Books tabs match `['发现', '书架', '书摘', '我的']`.
2. **Type Checking**:
   - `bun run type-check`: 0 errors.
3. **Screenshot Walkthrough**:
   - Capture `/books`, `/books/shelf`, `/books/notes`, `/books/me`, `/books/work/w-1`.
   - Inspect visually against pure-white minimal design tokens.
