# Mobile Music Module Comprehensive Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all remaining issues in the mobile music module, including native artist detail page, search routing and query syncing, guest vs authenticated playlist browsing, playback state robustness with full cover fallbacks, and player bottom padding adaptation.

**Architecture:** 
1. Build a native mobile `MusicArtistDetailView.vue` and replace the desktop drawer route (`/music/artist/:id`) to prevent mobile blank screen/sheet stack lockups.
2. Route music search exclusively to `/music/search` (not global search) and sync query parameters (`q` and `tab`) so that tab switching and URL deep-linking work immediately.
3. Redesign `MusicPlaylistsView.vue` with tabs for curated public playlists and personal playlists, ensuring guest users can listen to featured playlists without seeing unauthorized user data.
4. Strengthen audio player song normalization so that track covers, artists, and playback errors are cleanly resolved before entering the full-screen player.
5. Unify bottom padding across mobile views to adapt dynamically to Mini-Player presence and iPhone safe areas.

**Tech Stack:** Vue 3.4, TypeScript, Pinia, Vue Router 4, Tailwind CSS, Vitest.

## Global Constraints
- Follow `Atoman-Frontend/.claude/rules/frontend-ui.md` and `design_system.md`.
- No developer jargon in user-facing copy.
- Mobile views must never render desktop modals/drawers as primary navigation.
- Tests must pass via `bun run test:unit tests/unit/mobile/music-views.spec.ts`.
- TypeScript check must pass with 0 errors via `bun run type-check`.

---

### Task 1: Music Search Isolation and Query Parameter Synchronization

**Files:**
- Modify: `apps/mobile/components/system/MobileBottomNav.vue:60-75`
- Modify: `apps/mobile/MobileApp.vue:218-235`
- Modify: `apps/mobile/views/music/MusicSearchView.vue:1-70, 330-400`
- Test: `tests/unit/mobile/music-views.spec.ts`

**Interfaces:**
- Consumes: `useRoute`, `useRouter`, `writeSearchQuery`
- Produces: `MusicSearchView` handling `route.query.q` and `route.query.tab` (values: `'all' | 'songs' | 'albums' | 'artists' | 'playlists'`)

- [ ] **Step 1: Write tests for MusicSearchView query & tab synchronization**

In `tests/unit/mobile/music-views.spec.ts`, add test cases verifying:
- Entering `/music/search?q=kanye&tab=artists` populates `searchQuery` and sets `activeTab` to `'artists'`.
- Bottom navigation in music space always routes "搜索" to `/music/search` instead of `/search?module=music`.

- [ ] **Step 2: Update MobileBottomNav and MobileApp search handler**

- In `apps/mobile/components/system/MobileBottomNav.vue`, ensure that for `props.currentSpace === 'music'`, the `search` tab path remains `/music/search` instead of being rewritten to `/search?module=music`.
- In `apps/mobile/MobileApp.vue`, update `handleSearch` so when `currentSpace.value === 'music'`, it directly routes to `/music/search`.

- [ ] **Step 3: Update MusicSearchView to read route.query**

- Import and call `useRoute()` in `apps/mobile/views/music/MusicSearchView.vue`.
- Watch `route.query.q` and update `searchQuery` (triggering search if present).
- Watch `route.query.tab` and update `activeTab` when valid (`'all' | 'songs' | 'albums' | 'artists' | 'playlists'`).
- Ensure all artist item clicks navigate to `/music/artist/${artist.id}`.

- [ ] **Step 4: Verify with unit tests**

Run `cd Atoman-Frontend && bun run test:unit tests/unit/mobile/music-views.spec.ts`.

---

### Task 2: Native Mobile Artist Detail View (`MusicArtistDetailView.vue`)

**Files:**
- Create: `apps/mobile/views/music/MusicArtistDetailView.vue`
- Modify: `apps/mobile/mobileRoutes.ts:270-335`
- Test: `tests/unit/mobile/music-views.spec.ts`

**Interfaces:**
- Consumes: `getMusicArtist`, `listMusicSongs`, `listMusicAlbums` from `@/api/musicV1`, `usePlayerStore` from `@/stores/player`
- Produces: Native mobile component for `/music/artist/:artistId`

- [ ] **Step 1: Write test for MusicArtistDetailView**

In `tests/unit/mobile/music-views.spec.ts`, add test cases verifying:
- Renders artist avatar, name, and meta.
- Renders popular songs list with play functionality.
- Renders artist albums horizontal/grid list with navigation to `/music/album/:id`.
- Back button navigates back cleanly.

- [ ] **Step 2: Implement MusicArtistDetailView.vue**

Create `apps/mobile/views/music/MusicArtistDetailView.vue` with:
- Top sticky header with back button and title.
- Artist hero section (avatar, name, nationality/genres, bio toggle).
- "热门单曲" section (numbered track items, play track on click, duration display).
- "专辑作品" section (album cards with covers and release years, click to navigate to `/music/album/:id`).
- Play all button to start playback of all artist songs.
- Fallback mock data if API call fails.

- [ ] **Step 3: Update mobileRoutes.ts**

- Route `/music/artist/:artistId` to `MusicArtistDetailView.vue` instead of `MusicArtistRouteView.vue`.
- Redirect `/music/albums` to `/music/search?tab=albums`.
- Redirect `/music/artists` to `/music/search?tab=artists`.
- Redirect `/music/songs` to `/music/search?tab=songs`.

- [ ] **Step 4: Verify with unit tests**

Run `cd Atoman-Frontend && bun run test:unit tests/unit/mobile/music-views.spec.ts`.

---

### Task 3: Curated & Personal Tabs in Mobile Playlists View

**Files:**
- Modify: `apps/mobile/views/music/MusicPlaylistsView.vue:1-250`
- Test: `tests/unit/mobile/music-views.spec.ts`

**Interfaces:**
- Consumes: `listPublicMusicPlaylists`, `listMusicPlaylists`, `listPlaylistBookmarks` from `@/api/musicV1`, `authStore.isAuthenticated`
- Produces: Dual-tab playlist view: `精选歌单` (public to all users) and `我的歌单` (personal/bookmarks for logged-in, guest card for logged-out)

- [ ] **Step 1: Write tests for curated vs personal playlist tabs**

In `tests/unit/mobile/music-views.spec.ts`:
- Verify guest users can view and click curated public playlists in the `精选` tab.
- Verify guest users switching to `我的` tab see the `MGuestCard` login prompt.
- Verify authenticated users can see both curated playlists and their own created/bookmarked playlists.

- [ ] **Step 2: Implement tab switcher in MusicPlaylistsView.vue**

- Add tab buttons: `精选歌单` and `我的歌单` at the top of `MusicPlaylistsView.vue`.
- In `精选歌单` tab: fetch `listPublicMusicPlaylists`, render playlist grid cards with covers, names, and track counts.
- In `我的歌单` tab: if authenticated, fetch user's own playlists and bookmarks; if unauthenticated, show `MGuestCard`.
- Ensure tapping any playlist navigates to `/music/playlist/:id`.

- [ ] **Step 3: Verify with unit tests**

Run `cd Atoman-Frontend && bun run test:unit tests/unit/mobile/music-views.spec.ts`.

---

### Task 4: Playback State Robustness and Cover Art Fallback

**Files:**
- Modify: `apps/mobile/MobilePlayerView.vue:1-120, 250-320`
- Modify: `apps/mobile/views/music/MusicDiscoverView.vue:280-320`
- Modify: `apps/mobile/views/music/MusicAlbumDetailView.vue:180-210`
- Modify: `apps/mobile/views/music/MusicPlaylistDetailView.vue:180-210`
- Modify: `apps/mobile/views/music/MusicSearchView.vue:400-450`
- Test: `tests/unit/mobile/music-views.spec.ts`

**Interfaces:**
- Consumes: `usePlayerStore()`, `Song`
- Produces: Reliable track play normalization guaranteeing `cover_url`, `artist`, `album`, and preventing premature empty states in `MobilePlayerView`.

- [ ] **Step 1: Write tests for cover fallback and player transition**

In `tests/unit/mobile/music-views.spec.ts`:
- Verify `toPlayerSong` falls back to album cover, playlist cover, or placeholder.
- Verify `MobilePlayerView` restores playback state or retrieves song by `route.query.songId` when `currentSong` is momentarily null.

- [ ] **Step 2: Enhance toPlayerSong across all mobile music views**

- Ensure track objects passed to `player.playSong` consistently inherit album/playlist covers when `item.cover_url` is missing or empty.
- Ensure `player.currentSong` is set synchronously before navigating to `/music/player`.

- [ ] **Step 3: Update MobilePlayerView to avoid false "no content" screen**

- In `MobilePlayerView.vue`, read `route.query.songId`. If `player.currentSong` is empty but `songId` is in query or queue, attempt restore.
- When an audio playback error occurs, present a polite retry/skip action instead of crashing the player view.

- [ ] **Step 4: Verify with unit tests**

Run `cd Atoman-Frontend && bun run test:unit tests/unit/mobile/music-views.spec.ts`.

---

### Task 5: Scroll Padding and Safe Area Adaptation

**Files:**
- Modify: `apps/mobile/mobileContent.css:1-50`
- Modify: `apps/mobile/views/music/MusicDiscoverView.vue`
- Modify: `apps/mobile/views/music/MusicSearchView.vue`
- Modify: `apps/mobile/views/music/MusicPlaylistsView.vue`
- Modify: `apps/mobile/views/music/MusicAlbumDetailView.vue`
- Modify: `apps/mobile/views/music/MusicPlaylistDetailView.vue`
- Test: `tests/unit/mobile/music-views.spec.ts`

- [ ] **Step 1: Define CSS variable for mobile music scroll padding**

In `apps/mobile/mobileContent.css` or shared utility:
- Define `--mobile-music-page-bottom: calc(var(--mobile-app-player-bottom, 56px) + 56px + env(safe-area-inset-bottom, 16px))`
- Apply `padding-bottom: var(--mobile-music-page-bottom)` to `.mobile-music-discover`, `.mobile-music-search`, `.mobile-music-playlists`, `.mobile-album-detail`, `.mobile-playlist-detail`, `.mobile-artist-detail`.

- [ ] **Step 2: Verify in build and unit tests**

Run `bun run test:unit tests/unit/mobile/music-views.spec.ts` and `bun run type-check`.

---

### Task 6: Final End-to-End Verification and Clean Git Push

**Files:**
- All touched files in Tasks 1-5

- [ ] **Step 1: Run all mobile unit tests**
`cd Atoman-Frontend && bun run test:unit tests/unit/mobile/`

- [ ] **Step 2: Run full project type check**
`cd Atoman-Frontend && bun run type-check`

- [ ] **Step 3: Run production build**
`cd Atoman-Frontend && bun run build`

- [ ] **Step 4: Commit and push changes**
Commit with descriptive message and push to `origin/main`.
