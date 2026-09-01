# Implementation Plan: Video Detail Redesign

## Overview

Implement the approved video detail redesign in four Pi-tracked tasks. This document sits beside the existing Blog plan and does not modify it. Task tracking is authoritative in Pi tasks `#17` through `#20`.

## Dependency Graph

```text
Existing video + collection + channel subscription contracts
  -> validate shared content-rating identity and add video rating API
    -> compose VideoDetailView with collection context and reused components
      -> unit, API, browser, and full-suite verification
```

## Architecture Decisions

- Use `?collection=<id>` as the detail-page collection context. Validate it against the loaded collection members; otherwise use `video.collection_id`.
- Fetch collection members through the existing `GET /videos?collection_id=` contract. It supplies membership validation, ordered episodes, and recommendation exclusion without a new collection endpoint.
- Keep playlist state in the page or a narrowly-scoped composable. Do not overload the generic recommendation list component with playlist behavior.
- Preserve the existing explicit resume prompt: playlist navigation autoplays only when the target has no resumable position and no `?t=` deep-link seek.
- Reuse `PSheet + CommentSection` for the comments drawer, the existing channel-subscription store behavior, `PBookmarkButton + useVideoBookmarks`, and rating component semantics.
- Retain disabled quality, captions, and settings controls until their backend/media contracts exist; remove the false fixed quality label.
- Prefer reusing the `post_ratings` unified content identity only if video and rating access validation can be made correct without changing rating semantics. A new database table requires explicit approval.

## Task List

### Task 17 / Pi #17: Contract and baseline mapping

**Acceptance criteria**

- The specification records all user-approved layout, collection, interaction, comment, and player-control decisions.
- Existing API/component contracts and required gaps are identified.

**Verification**

- Read relevant frontend/backend sources and run the focused baseline test.

**Files**

- `tasks/SPEC-video-detail-redesign.md`
- `tasks/PLAN-video-detail-redesign.md`

### Task 18 / Pi #18: Video rating contract

**Acceptance criteria**

- Video detail exposes rating aggregate and viewer score.
- Authenticated viewers can set and clear a 0.5–5 star score using the existing 1–10 half-star representation.
- Rating access follows video visibility and ownership rules without affecting Blog ratings.

**Verification**

- New Go handler/service tests fail first, then pass.
- `go test` for affected packages and `go build ./...` pass.

**Likely files**

- Backend video route, handler/service, serialization, tests, and API documentation
- Frontend `src/api/video.ts`, `src/types.ts`

### Task 19 / Pi #19: Detail page composition

**Acceptance criteria**

- The responsive layout and query-based playlist behavior match the approved specification.
- Valid playlist navigation persists `collection`; invalid query context falls back safely.
- Recommendations exclude active-collection members; comments open in a PSheet; existing interaction components are used.

**Verification**

- New focused Vitest cases fail before source changes, then pass.
- Responsive browser checks cover desktop and 390px mobile widths.

**Likely files**

- `src/views/video/VideoDetailView.vue`
- focused video components/composables only when needed
- `tests/unit/views/video/VideoDetailView.spec.ts`
- relevant screenshot route/matrix test only if route coverage needs it

### Task 20 / Pi #20: Verification

**Acceptance criteria**

- No behavior regressions in existing resume, deep-link timestamp, playback, or mobile routing paths.
- All changed contracts are tested and visually checked.

**Verification**

- Targeted Vitest and Go tests
- `bun run type-check`
- `bun run test:unit` without concurrent builds
- `go build ./...`
- Browser desktop/mobile checks with clean console

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| A query collection does not include the current video. | Validate membership after fetching collection items, then fall back to primary collection. |
| Autoplay overrides resume or a deep-link timestamp. | Keep current `?t=` precedence and explicit resume prompt as hard guards. |
| Rating storage is Blog-specific despite a shared content ID. | Verify access and identity first; do not alter schema without approval. |
| A sticky playlist obscures layout at smaller widths. | Use sticky only above the desktop breakpoint; internal scrolling is bounded by the viewport. |
| Existing user worktree changes overlap. | Restrict edits to video feature files; read diffs before every modification and leave unrelated paths untouched. |

## Checkpoints

- After Task #18: rating API tests and backend build are green.
- After Task #19: focused VideoDetailView tests and type check are green.
- After Task #20: full frontend unit suite, backend build, and desktop/mobile browser checks are green.
