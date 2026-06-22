# Explore Sort Tabs Unification Design

## Context

The frontend currently has multiple explore surfaces that expose the same user-facing sort concept:

1. `热门`
2. `随机`

These controls are not visually consistent today.

Current state:

1. `src/views/feed/FeedRecommendedView.vue` uses `PPress` button-style controls for `热门 / 随机`
2. `src/views/music/HomeView.vue` uses a page-local custom `mode-tab` implementation
3. `src/views/kanbo/KanboVideosView.vue` already uses `PTab`, which matches the desired direction

The user wants all explore-page `热门 / 随机` controls to be one unified straight-corner tab style.

## Goals

1. Make all explore-page `热门 / 随机` sort controls look the same.
2. Reuse the existing shared `PTab` component instead of introducing a third pattern.
3. Keep behavior unchanged while only unifying the visual/control primitive.
4. Limit scope to genuine “explore sort” controls.

## Non-Goals

1. No redesign of unrelated action buttons.
2. No redesign of explore mode switches such as `文章浏览 / 频道浏览`.
3. No change to sort semantics, query parameters, or fetching logic.
4. No update to one-off random action buttons that are not part of a tabbed sort choice.

## Confirmed Product Decisions

### Target style

The unified target is the existing shared `PTab` language:

1. Straight-corner appearance
2. Transparent background
3. Bottom black highlight when active
4. Tab-like selection semantics instead of button-like emphasis

### Included surfaces

This iteration includes only real explore sort toggles:

1. `FeedRecommendedView.vue`
2. `music/HomeView.vue`

### Excluded surfaces

These are intentionally out of scope:

1. `文章浏览 / 频道浏览` mode switching in feed explore
2. `portal/HomeView.vue` random action button
3. Any non-explore action rows that happen to use similar labels

## UX Design

### Feed explore

In `FeedRecommendedView.vue`, the current `热门 / 随机` controls should stop looking like action buttons and become inline tabs.

Behavior stays the same:

1. `随机` maps to `sort === 'random'`
2. `热门` maps to `sort === 'popular'`
3. `返回订阅` remains an action control and should not be restyled as a tab

Recommended layout:

1. Keep `热门 / 随机` grouped as tabs
2. Keep `返回订阅` visually separate as an action

### Music explore

In `music/HomeView.vue`, replace the custom `mode-tab` markup/styling with shared `PTab`.

Behavior stays the same:

1. `热门` maps to `mode === 'hot'`
2. `随机` maps to `mode === 'random'`
3. Clicking an already-active option is still a no-op

### Visual consistency rule

The user’s intent is not just “similar enough.” The same sort concept should use the same interaction primitive.

That means:

1. Shared tab component
2. Shared active/inactive states
3. No local recreation of tab visuals when `PTab` already fits

## Frontend Architecture

### Shared component reuse

Use `src/components/ui/PTab.vue` directly on both surfaces.

Do not create:

1. A new `ExploreSortTabs` wrapper unless the shared `PTab` proves insufficient
2. A second local CSS tab recreation in `music/HomeView.vue`

### Feed view changes

`FeedRecommendedView.vue` should:

1. Import `PTab`
2. Replace the two `PPress` sort controls with `PTab`
3. Keep `PPress` for `返回订阅`

### Music view changes

`music/HomeView.vue` should:

1. Import `PTab`
2. Replace the custom tab buttons with `PTab`
3. Remove now-unneeded local `.mode-tab` styling that only existed to recreate tab behavior

## Testing Strategy

### Feed tests

Update feed explore tests so they continue validating:

1. The active sort can still be changed
2. Query synchronization remains unchanged
3. The rendered controls still expose the expected `热门 / 随机` choices

Tests should not depend on `PPress`-specific structure for the sort tabs.

### Music tests

Update music home tests so they continue validating:

1. Default mode is `热门`
2. Clicking `随机` still reloads with `sort: 'random'`
3. The page still renders the expected sort choices

### Regression focus

Guard against:

1. Accidentally restyling `返回订阅` into a tab
2. Accidentally changing feed query semantics
3. Accidentally changing music mode state semantics
4. Reintroducing local custom tab CSS in one explore page later

## Implementation Notes

This is intentionally a small-scope consistency pass.

Success means:

1. The two included explore pages now use the same sort-tab primitive
2. Existing behavior remains unchanged
3. No unrelated page controls were pulled into the refactor
