# Mobile Books Space Overhaul Implementation Plan

**Spec**: `docs/superpowers/specs/2026-10-21-mobile-books-overhaul-design.md`  
**Goal**: Overhaul mobile Books space into four pure-white minimal tabs: 发现 (`/books`), 书架 (`/books/shelf`), 书摘 (`/books/notes`), 我的 (`/books/me`), with dedicated BookDetailMobileView and persistent bottom navigation.

---

### Task 1: Navigation Shell & Route Setup
- **Files**:
  - `apps/mobile/components/system/spaceConstants.ts`
  - `apps/mobile/MobileApp.vue`
  - `apps/mobile/mobileRoutes.ts`
  - `tests/unit/mobile/navigation-shell.spec.ts`
- **Steps**:
  1. Update `SPACE_TABS.books` with `['发现', '书架', '书摘', '我的']`.
  2. Whitelist `/^\/books\/work\//` in `MobileApp.vue` to retain bottom navigation.
  3. Update `subRouteTitle` in `MobileApp.vue` to map `/books/work` appropriately.
  4. Update `tests/unit/mobile/navigation-shell.spec.ts` to assert Books tabs and verify.

### Task 2: Implement `BookDetailMobileView.vue` (图书详情页) & Upgrade `BooksDiscoverView.vue`
- **Files**:
  - `apps/mobile/views/books/BookDetailMobileView.vue`
  - `apps/mobile/views/books/BooksDiscoverView.vue`
  - `tests/unit/mobile/books-space.spec.ts`
- **Features**:
  - Book detail view: cover, title, author, rating, synopsis, chapter preview, "加入书架" and "开始阅读" actions, back button, bottom nav preserved.
  - Upgrade `BooksDiscoverView`: hero featured card, category filter chips (全部, 高分榜, 哲学, 文学, 科技, 社科), tapping book opens `/books/work/:id`.
- **Tests**:
  - `BooksDiscoverView` renders search, hero card, categories, and navigates to book detail.
  - `BookDetailMobileView` renders book info, toggles bookshelf state, and navigates to reader.

### Task 3: Upgrade `BooksShelfView.vue` (Tab 2: 书架)
- **Files**:
  - `apps/mobile/views/books/BooksShelfView.vue`
  - `tests/unit/mobile/books-space.spec.ts`
- **Features**:
  - "当前在读" progress tracker card (3px bar, percentage, continue reading).
  - Books list with format badges and tapping book opens detail view.
  - Tapping continue reading button opens reader.
- **Tests**:
  - Renders current reading card and books list.
  - Clicking continue reading navigates to reader.

### Task 4: Implement `BooksNotesView.vue` (Tab 3: 书摘)
- **Files**:
  - `apps/mobile/views/books/BooksNotesView.vue`
  - `tests/unit/mobile/books-space.spec.ts`
- **Features**:
  - Header: "书摘" with subtitle.
  - Book highlights stream: book title badge, quote card with subtle golden left border, user's reflection note, copy/share/delete actions.
  - Empty state with guidance.
- **Tests**:
  - Renders list of book highlights and notes.
  - Deleting a note removes it from list.

### Task 5: Implement `BooksMeView.vue` (Tab 4: 我的)
- **Files**:
  - `apps/mobile/views/books/BooksMeView.vue`
  - `tests/unit/mobile/books-space.spec.ts`
- **Features**:
  - Reader profile card with avatar, name, handle, bio.
  - 4 stats: 在读 (count), 读过 (count), 书摘 (count), 阅读时长 (hours).
  - Annual reading target card with progress bar.
  - Sub-tabs: 「在读书籍」, 「已读书单」.
- **Tests**:
  - Renders reader profile, stats, and annual goal.
  - Switches between sub-tabs.

### Task 6: Verification, Type-Check, Screenshot Walkthrough & Push
- Run `bun run type-check`.
- Run all mobile unit tests (`bun run test:unit tests/unit/mobile/`).
- Capture Playwright mobile screenshots on `/books`, `/books/shelf`, `/books/notes`, `/books/me`, `/books/work/w-1`.
- Push to `origin/main`.
