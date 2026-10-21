# Mobile Real-Data Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all remaining mock/sample data across mobile modules (Messages, Blog, Feed, Books, Central Me) with real backend data, real Pinia stores, and clean `MGuestCard` guest states.

**Architecture:** Each mobile module station integrates directly with existing frontend stores (`useDMStore`, `useNotificationStore`, `useFeedStore`, `useAuthStore`) and API client functions (`@/api/blog`, `@/api/bookPrivate`, `@/api/bookReading`). When unauthenticated, "我的" views consistently display `MGuestCard` with zero hardcoded fake identities. Each station maintains test-compatibility via props fallback while hydrating live backend data on mount.

**Tech Stack:** Vue 3.4, Vite, TypeScript 5.8, Pinia 2, Vue Router 4, Tailwind CSS v4, Vitest, `@atoman/api-client`.

---

## Global Constraints

- **Design System**: Pure-White Minimal Design System (surface `#ffffff`, 4px radius `var(--a-radius-card)`, 1px soft borders `var(--a-color-border-soft)`, font weights 500/600, no 999px pills, no dev jargon).
- **Guest State Rule**: Every "我的" view (`/inbox/me`, `/posts/me`, `/feed/me`, `/books/me`, `/me`) MUST display `MGuestCard` when unauthenticated (`!authStore.isAuthenticated`), offering clean 1-click login navigation.
- **Session Auto-Restore**: Routes with `meta: { restoreSession: true }` attempt silent session restoration on load.
- **Backward Compatibility**: Preserve existing component `props` (`initial*`) so existing tests continue to pass without regression.
- **Verification Gate**: Every task must pass `bun run test:unit`, `bun run type-check`, and maintain 100% green test suite status.

---

## Task Decomposition

### Task 1: Messages Real-Data Wiring (`/inbox`, `/inbox/chat/:id`, `/inbox/notifications`, `/inbox/contacts`, `/inbox/me`)

**Files:**
- Modify: `apps/mobile/views/messages/MessagesMobileView.vue`
- Modify: `apps/mobile/views/messages/MessageChatMobileView.vue`
- Modify: `apps/mobile/views/messages/MessagesNotificationsView.vue`
- Modify: `apps/mobile/views/messages/MessagesContactsView.vue`
- Modify: `apps/mobile/views/messages/MessagesMeView.vue`
- Modify: `apps/mobile/mobileRoutes.ts:59-62` (add `meta: { restoreSession: true }` to `/inbox/me`)
- Test: `tests/unit/mobile/messages-real-data.spec.ts`

**Interfaces:**
- Consumes: `useDMStore()` (`conversations`, `reconcileFromServer()`, `openConversation()`, `sendMessage()`, `messagesByConversation`, `dmUnread`), `useNotificationStore()` (`notifications`, `unreadCount`, `loadNotifications()`, `markAsRead()`, `markAllAsRead()`), `useUserBlocksStore()`, `useAuthStore()`.
- Produces: Real conversations list mapped from `DMConversation`, real message exchange in chat view, real notification stream with mark-as-read, real contact list derived from active conversations, and real unread counts on `/inbox/me` with `MGuestCard` guest state.

- [ ] **Step 1: Write failing unit test suite for messages real data**
  - Create `tests/unit/mobile/messages-real-data.spec.ts`:
    - Test `MessagesMobileView`: calls `dmStore.reconcileFromServer()` and renders real conversations from `dmStore.conversations`.
    - Test `MessageChatMobileView`: opens conversation by route param `id`, renders messages from `dmStore.messagesByConversation`, and dispatches `dmStore.sendMessage()`.
    - Test `MessagesNotificationsView`: renders notifications from `notificationStore` and triggers `markAllAsRead()`.
    - Test `MessagesMeView`: renders `MGuestCard` when unauthenticated, and displays real store counters (`dmUnread`, `notificationStore.unreadCount`) when authenticated.

- [ ] **Step 2: Run test to confirm failure**
  ```bash
  cd Atoman-Frontend && bun run test:unit tests/unit/mobile/messages-real-data.spec.ts
  ```

- [ ] **Step 3: Implement real data in messages views**
  - In `MessagesMobileView.vue`:
    - Fix `loadConversations()`: map `c.id`, `c.other_party.display_name`, `c.other_party.avatar_url`, `c.last_message_preview`, `c.unread_count`, `c.last_message_at`.
    - If authenticated and conversations list is empty, display clean empty state instead of sample data.
  - In `MessageChatMobileView.vue`:
    - Wire `useDMStore()`: on mount, call `dmStore.openConversation(route.params.id)`.
    - Map store messages to view bubbles; call `dmStore.sendMessage(inputText)` on send.
  - In `MessagesNotificationsView.vue`:
    - Wire `useNotificationStore()`: call `notificationStore.loadNotifications()` on mount.
    - Wire `markAllAsRead()` button and single item `markAsRead(item.id)`.
  - In `MessagesContactsView.vue`:
    - Derive contacts list dynamically from `dmStore.conversations` parties.
  - In `MessagesMeView.vue`:
    - Check `authStore.isAuthenticated`. If guest, render `<MGuestCard title="登录查看消息档案" description="登录后可与创作者交流、接收系统通知并管理互动记录。" redirect="/inbox/me" />`.
    - If authenticated, display real stats: `unreadDMs = dmStore.dmUnread`, `unreadNotifications = notificationStore.unreadCount`, `blacklistCount = userBlocksStore.blockedUsers.length`.

- [ ] **Step 4: Verify test suite and type check**
  ```bash
  cd Atoman-Frontend && bun run test:unit tests/unit/mobile/messages-real-data.spec.ts
  bun run type-check
  ```

- [ ] **Step 5: Commit changes**
  ```bash
  git commit -m "feat(mobile): wire Messages views to real DM and notification stores with MGuestCard"
  ```

---

### Task 2: Blog Real-Data Wiring (`/posts/me`, `/posts/notes`, `/posts/articles`)

**Files:**
- Modify: `apps/mobile/views/blog/BlogMeView.vue`
- Modify: `apps/mobile/views/blog/BlogNotesTimelineView.vue`
- Modify: `apps/mobile/views/blog/BlogArticlesView.vue`
- Modify: `apps/mobile/mobileRoutes.ts:203-206` (ensure `meta: { restoreSession: true }` on `/posts/me`)
- Test: `tests/unit/mobile/blog-real-data.spec.ts`

**Interfaces:**
- Consumes: `useAuthStore()`, `useApi()` (`api.blog.shortNotes`, `api.blog.posts`, `api.blog.bookmarks`), `apiRequestResult`, `MGuestCard.vue`.
- Produces: Real author profile from `authStore.user`, live short notes and articles list for the logged-in user, live bookmarks list, and `MGuestCard` for guests.

- [ ] **Step 1: Write failing unit test suite for blog real data**
  - Create `tests/unit/mobile/blog-real-data.spec.ts`:
    - Test `BlogMeView`: renders `MGuestCard` when unauthenticated.
    - Test `BlogMeView`: when authenticated, fetches user's short notes and articles, rendering real author name and counts.
    - Test `BlogNotesTimelineView`: fetches timeline short notes from `api.blog.shortNotes`.
    - Test `BlogArticlesView`: fetches published articles from `api.blog.posts`.

- [ ] **Step 2: Run test to confirm failure**
  ```bash
  cd Atoman-Frontend && bun run test:unit tests/unit/mobile/blog-real-data.spec.ts
  ```

- [ ] **Step 3: Implement real data in blog views**
  - In `BlogMeView.vue`:
    - Import `useAuthStore`, `useApi`, `apiRequestResult`, `MGuestCard`.
    - If `!authStore.isAuthenticated`: render `MGuestCard` (`title="登录查看创作者中心"`, `redirect="/posts/me"`).
    - If authenticated:
      - Populate profile from `authStore.user` (display name, username, avatar).
      - In `loadUserData()`: fetch user's short notes via `${api.blog.shortNotes}?author_id=${authStore.user?.uuid || authStore.user?.id}`, articles via `${api.blog.posts}?author_id=${authStore.user?.uuid || authStore.user?.id}`, and bookmarks via `api.blog.bookmarks`.
      - Compute stats from real responses.
  - In `BlogNotesTimelineView.vue`:
    - Call `${api.blog.shortNotes}` on mount when `initialNotes` is undefined.
  - In `BlogArticlesView.vue`:
    - Call `${api.blog.posts}` on mount when `initialArticles` is undefined.

- [ ] **Step 4: Verify test suite and type check**
  ```bash
  cd Atoman-Frontend && bun run test:unit tests/unit/mobile/blog-real-data.spec.ts
  bun run type-check
  ```

- [ ] **Step 5: Commit changes**
  ```bash
  git commit -m "feat(mobile): wire Blog views to real blog APIs and author center with MGuestCard"
  ```

---

### Task 3: Feed Real-Data Wiring (`/feed/following`, `/feed/starred`, `/feed/me`, `/feed/sources`)

**Files:**
- Modify: `apps/mobile/views/feed/FeedFollowingView.vue`
- Modify: `apps/mobile/views/feed/FeedStarredView.vue`
- Modify: `apps/mobile/views/feed/FeedMeView.vue`
- Modify: `apps/mobile/views/feed/FeedSourcesView.vue`
- Test: `tests/unit/mobile/feed-real-data.spec.ts`

**Interfaces:**
- Consumes: `useFeedStore()` (`timeline`, `subscriptions`, `fetchSubscriptions()`, `fetchTimeline()`, `subscribeToRSS()`, `unsubscribe()`), `useAuthStore()`, `apiRequestResult(`${api.url}/feed/stars`)`.
- Produces: Live following stream from subscriptions, live starred articles list from backend stars API, live RSS sources management, and `FeedMeView` with real subscription/starred counts and `MGuestCard`.

- [ ] **Step 1: Write failing unit test suite for feed real data**
  - Create `tests/unit/mobile/feed-real-data.spec.ts`:
    - Test `FeedFollowingView`: fetches timeline via `feedStore.fetchTimeline()` and renders articles.
    - Test `FeedStarredView`: fetches stars from `/feed/stars` when authenticated.
    - Test `FeedMeView`: renders `MGuestCard` when unauthenticated; renders real user name and counts (`sourcesCount`, `starredCount`) when authenticated.
    - Test `FeedSourcesView`: loads feeds from `feedStore.subscriptions` and handles unsubscribe.

- [ ] **Step 2: Run test to confirm failure**
  ```bash
  cd Atoman-Frontend && bun run test:unit tests/unit/mobile/feed-real-data.spec.ts
  ```

- [ ] **Step 3: Implement real data in feed views**
  - In `FeedFollowingView.vue`:
    - Wire `useFeedStore()`: call `feedStore.fetchTimeline()` on mount.
    - Map `feedStore.timeline` items (type `feed_item`) to `FollowingArticleItem`.
    - If authenticated and timeline is empty, show clean empty state.
  - In `FeedStarredView.vue`:
    - Fetch from `${api.url}/feed/stars` with `Authorization: Bearer ${authStore.token}` on mount.
    - Map returned items to `StarredArticleItem`.
  - In `FeedMeView.vue`:
    - If `!authStore.isAuthenticated`: render `MGuestCard` (`title="登录查看订阅档案"`, `redirect="/feed/me"`).
    - If authenticated:
      - Display user info from `authStore.user`.
      - Call `feedStore.fetchSubscriptions()` to get accurate `sourcesCount = feedStore.subscriptions.length`.
      - Query starred count from `${api.url}/feed/stars?limit=1` to populate `starredCount`.
  - In `FeedSourcesView.vue`:
    - Call `feedStore.fetchSubscriptions()` on mount if `initialSources` is undefined.

- [ ] **Step 4: Verify test suite and type check**
  ```bash
  cd Atoman-Frontend && bun run test:unit tests/unit/mobile/feed-real-data.spec.ts
  bun run type-check
  ```

- [ ] **Step 5: Commit changes**
  ```bash
  git commit -m "feat(mobile): wire Feed views to real feed store, stars API and MGuestCard"
  ```

---

### Task 4: Books Real-Data Wiring (`/books/shelf`, `/books/notes`, `/books/me`)

**Files:**
- Modify: `apps/mobile/views/books/BooksShelfView.vue`
- Modify: `apps/mobile/views/books/BooksNotesView.vue`
- Modify: `apps/mobile/views/books/BooksMeView.vue`
- Test: `tests/unit/mobile/books-real-data.spec.ts`

**Interfaces:**
- Consumes: `@/api/books` (`listContinueReading`, `listBookShelf`, `listBookImports`), `@/api/bookPrivate` (`listLibrary`, `listPrivateNotes`), `useAuthStore()`, `MGuestCard.vue`.
- Produces: Live bookshelf items and reading progress without mock fallbacks, live private annotations/notes stream, and `BooksMeView` with real reading stats and `MGuestCard`.

- [ ] **Step 1: Write failing unit test suite for books real data**
  - Create `tests/unit/mobile/books-real-data.spec.ts`:
    - Test `BooksShelfView`: when authenticated with no reading records, displays empty shelf state rather than fallback mock books.
    - Test `BooksNotesView`: fetches notes from `listPrivateNotes()`; renders empty state when empty.
    - Test `BooksMeView`: renders `MGuestCard` when unauthenticated; renders real reading counts from `listLibrary()` when authenticated.

- [ ] **Step 2: Run test to confirm failure**
  ```bash
  cd Atoman-Frontend && bun run test:unit tests/unit/mobile/books-real-data.spec.ts
  ```

- [ ] **Step 3: Implement real data in books views**
  - In `BooksShelfView.vue`:
    - When unauthenticated or API returns empty, set `fetchedCurrentReading = null` and `fetchedBooks = []` rather than falling back to `defaultSampleCurrent` and `defaultSampleBooks`.
    - Provide a clean empty shelf CTA ("书架暂无图书，去发现好书").
  - In `BooksNotesView.vue`:
    - Import `listPrivateNotes` from `@/api/bookPrivate`.
    - On mount, if `initialNotes` is undefined, call `listPrivateNotes()`.
    - Map notes to `BookNoteItem` and display empty state when count is 0.
  - In `BooksMeView.vue`:
    - If `!authStore.isAuthenticated`: render `MGuestCard` (`title="登录查看书房档案"`, `redirect="/books/me"`).
    - If authenticated:
      - Display user info from `authStore.user`.
      - Call `listLibrary()`: count `readingCount` (status === 'reading'), `finishedCount` (status === 'read').
      - Call `listPrivateNotes()`: get total notes count.

- [ ] **Step 4: Verify test suite and type check**
  ```bash
  cd Atoman-Frontend && bun run test:unit tests/unit/mobile/books-real-data.spec.ts
  bun run type-check
  ```

- [ ] **Step 5: Commit changes**
  ```bash
  git commit -m "feat(mobile): wire Books shelf, notes, and profile to real backend APIs and MGuestCard"
  ```

---

### Task 5: Central Profile Dynamic Counters (`/me` ProfileMobileView)

**Files:**
- Modify: `apps/mobile/views/me/ProfileMobileView.vue`
- Modify: `apps/mobile/mobileRoutes.ts:83-86` (add `meta: { restoreSession: true }`)
- Test: `tests/unit/mobile/profile-real-data.spec.ts`

**Interfaces:**
- Consumes: `useAuthStore()`, `useDMStore()`, `listLibrary`, `api.blog.posts`, `api.blog.bookmarks`, `apiRequestResult(`${api.url}/feed/reading-list`)`, `listAlbumBookmarks`.
- Produces: Dynamically aggregated user profile counters across all spaces, real user avatar and bio, and clean `MGuestCard` when unauthenticated.

- [ ] **Step 1: Write failing unit test suite for central profile real data**
  - Create `tests/unit/mobile/profile-real-data.spec.ts`:
    - Test `ProfileMobileView`: renders `MGuestCard` when unauthenticated.
    - Test `ProfileMobileView`: when authenticated, fetches cross-module counts (articles, reading books, total bookmarks) and renders them in the stats grid.

- [ ] **Step 2: Run test to confirm failure**
  ```bash
  cd Atoman-Frontend && bun run test:unit tests/unit/mobile/profile-real-data.spec.ts
  ```

- [ ] **Step 3: Implement dynamic stats aggregator in ProfileMobileView**
  - In `ProfileMobileView.vue`:
    - Check `authStore.isAuthenticated`. If unauthenticated, render `<MGuestCard title="登录查看个人中心" description="登录后可管理账号、同步全空间数据及个性化设置。" redirect="/me" />`.
    - If authenticated:
      - Set display name, username, avatar, bio from `authStore.user`.
      - In `loadUserStats()`: query in parallel via `Promise.allSettled`:
        1. User articles count (`api.blog.posts?author_id=...`)
        2. In-progress books count (`listLibrary()` with status 'reading')
        3. Cross-module bookmarks (blog bookmarks + music bookmarks + feed reading list)
        4. Followers count (or 0)
      - Update reactive `profileData.stats`.

- [ ] **Step 4: Verify test suite and type check**
  ```bash
  cd Atoman-Frontend && bun run test:unit tests/unit/mobile/profile-real-data.spec.ts
  bun run type-check
  ```

- [ ] **Step 5: Commit changes**
  ```bash
  git commit -m "feat(mobile): aggregate dynamic cross-module stats in ProfileMobileView with MGuestCard"
  ```

---

### Task 6: Whole-System Integration & Visual Verification

**Files:**
- Test: Full mobile unit test suite execution (`bun run test:unit tests/unit/mobile/`)
- Verification: Mobile production build (`bun run build:mobile`)
- Visual Verification: Playwright screenshot capture of guest and authenticated states across all 5 overhauled spaces.

- [ ] **Step 1: Run full unit test suite across all mobile modules**
  ```bash
  cd Atoman-Frontend && bun run test:unit tests/unit/mobile/
  ```
  Ensure all 20+ test suites pass with 100% success rate.

- [ ] **Step 2: Run type check and production mobile build**
  ```bash
  cd Atoman-Frontend && bun run type-check
  bun run build:mobile
  ```

- [ ] **Step 3: Capture Playwright visual companion screenshots**
  - Capture guest cards and authenticated states for:
    - `/inbox/me`
    - `/posts/me`
    - `/feed/me`
    - `/books/me`
    - `/me`
  - Verify alignment with Pure-White Minimal Design System (4px radius, soft borders, 500/600 font weights).

- [ ] **Step 4: Final commit and push**
  ```bash
  git push origin main
  ```
