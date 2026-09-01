# Spec: Video Detail Redesign

## Objective

Deliver a video-detail experience centered on watching and continuous playback. Desktop readers can watch in the main column while navigating a sticky ordered collection in the right column. Mobile readers get the same information architecture in a vertical flow. The page reuses existing rating, bookmark, subscription, playback, sheet, and comment contracts instead of creating parallel behavior.

## Confirmed Experience

### Desktop layout

1. The main column contains the 16:9 player, title and author identity, four same-width recommendation cards, a collapsed description, then the interaction row.
2. The right column contains one ordered collection playlist. It is sticky below the site header and its list scrolls internally.
3. A collection item shows position, title, duration, and one state only: completed, current, or unplayed. No per-item progress bars or elapsed time.
4. Recommendation cards exclude every video in the active collection. Each card shows thumbnail, duration, two-line title, and `channel name · account name`.

### Collection context

- A valid `collection` query parameter is the active collection context.
- Playlist navigation preserves `collection` when routing to another episode.
- With no query parameter, the video author's selected primary collection (`video.collection_id`) is used.
- An inaccessible, invalid, or non-member query collection falls back to the primary collection.
- A target without any valid collection does not render an empty collection panel.

### Mobile layout

The reading order is: player -> title and channel subscription -> collection -> recommendations -> description -> interactions. The collection is not sticky on mobile.

### Identity, interaction, and comments

- The title is followed by avatar, channel name, account name, and a channel subscription control.
- Description defaults to three lines. Tags appear inside the expanded description, not as a separate row.
- One interaction row places rating, bookmark, and share on the left. The comment entry remains at the right and opens a right-side sheet.
- Bookmarking uses `PBookmarkButton` and `useVideoBookmarks`.
- Comments use the established `PSheet + CommentSection` composition and retain video timestamp seeking.
- The video rating UI reuses the existing rating component behavior. Video rating persistence requires a video-specific API contract built over the current unified content-rating storage where safe.

### Player controls

- Local video preserves seek, preview thumbnails, play/pause, time, volume, speed, theater mode, and fullscreen.
- Quality, captions, and settings remain visibly disabled until their real media/API contracts exist. Quality must use a generic label rather than a fabricated `1080P` claim.
- Third-party embeds retain their native player controls.

## Tech Stack

- Frontend: Vue 3, TypeScript, Pinia, Vue Router, Vitest, Playwright.
- Backend: Go, Gin, GORM, PostgreSQL-compatible migrations.

## Commands

```bash
cd /root/Atoman/.pi/worktree/atoman-frontend-task-01a0475b-2e47-7a09-bb94-627613cb
bun run test:unit -- tests/unit/views/video/VideoDetailView.spec.ts
bun run type-check
bun run test:unit

cd /root/Atoman/.pi/worktree/atoman-backend-task-01a0475b-2e47-7a09-bb94-627613cb
go test ./internal/handlers ./internal/modules/...
go build ./...
```

## Project Structure

```text
src/views/video/VideoDetailView.vue       page composition and local state
src/components/video/                     playlist, player, and video-specific UI
src/components/shared/                    shared player and interaction primitives
src/components/ui/                        bookmark and sheet primitives
src/api/video.ts                          video API client
src/composables/useVideoBookmarks.ts      bookmarked-video state
internal/handlers/                        video routes and serialization
internal/model/                           video and shared content models
internal/modules/                         reusable domain services
tests/unit/views/video/                   page behavior tests
```

## Code Style

Use existing Vue Composition API and small derived helpers rather than template-side conditionals:

```ts
const activeCollectionId = computed(() => {
  const requested = getFirstStringQueryValue(route.query.collection)
  return collectionContainsCurrentVideo(requested) ? requested : primaryCollectionId.value
})
```

Use existing component events and typed API helpers. Do not duplicate comment, bookmark, rating, or subscription state machines.

## Testing Strategy

- Unit-test valid collection query selection, fallback behavior, preservation on playlist navigation, recommendation exclusion, drawer opening, component props, and responsive DOM contracts.
- Backend-test rating access, upsert, clear, and detail serialization if a video-rating route is added.
- Run focused Vitest and Go tests during RED/GREEN cycles; run frontend full unit suite, frontend type check, Go build, and browser desktop/mobile verification before completion.

## Boundaries

- Always: use task worktrees, preserve unrelated changes, reuse existing components, add behavior tests before implementation, and keep URL collection context validated.
- Ask first: new database tables, new dependencies, production deployment, or changing existing rating semantics outside video.
- Never: fabricate enabled player functionality, show a false quality label, override a valid `?t=` deep link with autoplay, or remove existing accessibility affordances.

## Success Criteria

- Desktop and mobile layout follows the confirmed information architecture.
- A valid collection query determines the playlist; invalid context safely falls back to the video's primary collection.
- Playlist navigation retains context and honors resume behavior.
- Recommendations exclude all active-collection episodes.
- Rating, bookmark, share, channel subscription, and comment-sheet actions use existing contracts or have tested video-specific extensions.
- Unsupported player controls remain accurately disabled.
- Focused tests, full frontend unit suite, type check, backend build/tests, and browser checks pass.

## Open Questions

- Whether the existing `post_ratings` unified content identity can be safely generalized for video without a new table. This must be confirmed by Task #18 before code changes to rating persistence.
