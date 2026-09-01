# Subscription Hub Implementation Plan

## Overview

Replace the current `/feed/subscriptions` view with the confirmed daily-use subscription hub:

```text
Sidebar:   Type -> group -> channel / account / RSS source
Content:   newest updates for the selected type and group
```

The subscription hub has no cross-type "all" view, no global deduplication, and no cross-type cancellation. `Podcast`, `Video`, `Blog`, and `RSS` are separate type roots. A channel may be present in several type branches without being merged.

## Architecture Decisions

- Host the hub at the existing `/feed/subscriptions` route. `Feed` is already the product's subscription aggregation module; `/feed/sources` remains the RSS source-management timeline.
- Keep the selected type, group, and optional leaf subscription in the route query so sidebar selection is linkable and refresh-safe.
- Add a server-owned subscription tree and update stream. The frontend must not infer type-scoped groups from separate bookmark APIs or store group state locally.
- Treat every leaf as a type-scoped subscription. Moving, muting, or deleting a leaf affects only its current type branch.
- Use the existing application shell (`FeedLayout` and `AppSidebar`), with a new bottom-slot tree component only on the subscription route.

## API Contract Required

### `GET /feed/subscription-tree`

Returns the complete authenticated sidebar tree. A group belongs to exactly one `type`.

```ts
type SubscriptionType = 'podcast' | 'video' | 'blog' | 'rss'

interface SubscriptionTreeNode {
  id: string
  type: SubscriptionType
  label: string
  groups: Array<{
    id: string
    name: string
    position: number
    unread_count: number
    subscriptions: Array<{
      id: string
      label: string
      avatar_url?: string
      unread_count: number
      href: string
    }>
  }>
  unassigned: Array<{
    id: string
    label: string
    avatar_url?: string
    unread_count: number
    href: string
  }>
}
```

### `GET /feed/subscription-updates?type=<type>&group_id=<id>&subscription_id=<id?>`

Returns the chronologically ordered update stream for one selected type/group (and optionally one leaf). Each response item carries its concrete content type and destination URL, so the frontend can render podcast, video, blog, and RSS updates without guessing their origin.

### Mutation Endpoints

- Create, rename, delete, and reorder groups scoped to one type.
- Move one subscription only within its type.
- Subscribe/unsubscribe one type-scoped leaf.
- Mark updates read for the selected type/group.

## Task List

### Task 1: Backend subscription-context model and tree API

**Acceptance criteria**

- Type-scoped groups persist independently for podcast, video, blog, and RSS.
- The same channel can be in different groups under different types without overwriting either assignment.
- `GET /feed/subscription-tree` returns a complete authenticated tree.
- Existing RSS/Feed grouping data migrates into the `rss` type without data loss.

**Verification**

- Backend handler/service tests cover cross-type isolation, group move isolation, and migration defaults.
- `go build ./...` passes.

**Blocked by**

- The assigned backend task worktree `/root/Atoman/.pi/worktree/atoman-backend-task-01a048d9-eca2-7e98-b210-b7e9fe6c` is absent. Do not create or modify a replacement manually; provision it through the task-worktree workflow.

### Task 2: Backend selected-update stream API

**Acceptance criteria**

- Returns newest-first updates only for the selected type/group/leaf.
- Supports podcast episodes, videos, blog posts, and RSS items through a stable normalized response.
- Unread/continue state is included where available.

**Verification**

- Handler tests prove that selecting `podcast/group-a` never returns video/blog/RSS updates.
- Handler tests prove leaf selection narrows the group stream.

**Dependencies**

- Task 1.

### Task 3: Frontend data contract and focused tests

**Files likely touched**

- `src/api/subscriptions.ts` (new)
- `src/types.ts`
- `tests/unit/api/subscriptions.spec.ts` (new)

**Acceptance criteria**

- Typed client wraps the tree and update endpoints.
- Response normalization is explicit and rejects malformed data safely.

**Verification**

- Focused Vitest tests first fail against the absent client, then pass for tree/update request formation and normalization.

**Dependencies**

- Tasks 1-2.

### Task 4: Subscription sidebar tree

**Files likely touched**

- `src/components/feed/SubscriptionTreeSidebar.vue` (new)
- `src/components/system/AppSidebar.vue`
- `src/views/feed/FeedLayout.vue`
- `tests/unit/components/feed/SubscriptionTreeSidebar.spec.ts` (new)

**Acceptance criteria**

- Bottom sidebar renders type -> group -> leaf hierarchy.
- Selection updates only `type`, `group_id`, and optional `subscription_id` in `/feed/subscriptions` query state.
- RSS source sidebar remains unchanged on `/feed/sources`.
- Collapsed and mobile sidebars preserve existing behavior.

**Dependencies**

- Task 3.

### Task 5: Subscription hub update page

**Files likely touched**

- `src/views/feed/SubscriptionHubView.vue` (new)
- `src/router/routes/modules.ts`
- `tests/unit/views/feed/SubscriptionHubView.spec.ts` (new)

**Acceptance criteria**

- `/feed/subscriptions` uses the new page while `/feed/sources` keeps `FeedView`.
- Header and content area show the selected type/group context.
- Content stream is newest-first and type-limited.
- Loading, unauthenticated, empty, and request-error states are all explicit.
- Podcast cards expose play/continue actions through existing player APIs; other item types route to their existing detail pages.

**Dependencies**

- Tasks 3-4.

### Task 6: End-to-end verification and visual review

**Acceptance criteria**

- Podcast, video, blog, and RSS tree branches render independently.
- Switching a group changes the content stream and preserves the route query after refresh.
- The desktop shell matches the approved page layout; the mobile layout exposes the tree through the existing source-sheet pattern.

**Verification**

- Focused Vitest suite for Tasks 3-5 passes.
- `bun run type-check` passes.
- `bun run test:unit:changed` passes.
- `bun run build` passes.
- Browser screenshots confirm desktop and mobile layout, including a selected `播客 -> A 分组` state.

## Checkpoints

- After Tasks 1-2: review API payloads and cross-type isolation before frontend wiring.
- After Tasks 3-5: run type-check and focused unit tests before visual review.
- After Task 6: run build and inspect final diff before `/push`.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Existing Feed groups are global | Migrate them into `rss` explicitly; do not reinterpret them as podcast/video/blog groups. |
| Podcast and video currently use independent bookmark APIs | Convert them into server-side type-scoped subscription contexts; do not join them in browser memory. |
| A channel appears in more than one type | Keep one leaf per type branch; UI never performs cross-type deduplication. |
| Backend worktree is unavailable | Do not implement a fake persistent frontend store. Resume Task 1 only in the hook-provisioned backend worktree. |
