# Feed Explore Channel Browser Design

## Context

The feed explore page already supports article-centric browsing in `src/views/feed/FeedRecommendedView.vue`. The user wants this surface expanded into a two-mode explore experience:

1. Keep the current article browsing flow.
2. Add an iFeed-style channel browsing flow.

The selected product direction is:

- Top-level dual entry, not a unified split pane.
- `文章浏览` remains as the current timeline-based explore mode.
- `频道浏览` becomes a source discovery mode built around feed source cards.
- Clicking a channel does not navigate away. It opens a side sheet / drawer with that channel's articles.

## Goals

1. Preserve the current article browse experience with minimal disruption.
2. Add a second explore mode that helps users discover worthwhile channels first, then inspect their content.
3. Use popularity/activity signals for channel ranking instead of a manually curated list.
4. Keep anonymous read access for explore content.
5. Reuse the existing feed UI language and existing source-article sheet behavior where practical.

## Non-Goals

1. No separate channel detail page.
2. No personalized recommendation engine.
3. No manually maintained featured-channel pool in this iteration.
4. No replacement of the current article explore mode.
5. No multi-pane desktop-only information architecture.

## Confirmed Product Decisions

### Explore information architecture

The explore page stays as one route and one page shell.

At the top of the page, add two mutually exclusive modes:

1. `文章浏览`
2. `频道浏览`

`文章浏览` keeps the current article timeline exploration behavior.

`频道浏览` replaces the main content area with a channel card list. The intent is closer to `ifeed.cc/discover`: discover channels first, then inspect their content.

### Channel drill-in behavior

Clicking a channel card opens a side sheet / drawer on the current page.

The drawer shows:

1. Channel title
2. Subscription state
3. RSS URL or source link when available
4. Recent article list for that channel
5. Subscribe action

This explicitly avoids route navigation and avoids building a dedicated detail page in this iteration.

### Channel ranking semantics

The primary channel list should prefer sources that are:

1. Subscribed by more users
2. Still recently active

Recommended primary ordering:

1. `subscription_count DESC`
2. `last_published_at DESC`

This gives a simple and explainable “popular and alive” ordering without inventing a recommendation system.

## UX Design

### Page header and controls

Keep the existing `探索` page shell and return action.

Replace the current article-only sort controls as follows:

1. First row: mode switch between `文章浏览` and `频道浏览`
2. Second row:
   - In `文章浏览`, keep the current article sort controls such as `随机` and `热门`
   - In `频道浏览`, replace article sort controls with channel-oriented context text and a fixed `热门频道` label

This separation prevents channel browse semantics from inheriting article-oriented controls that do not fit.

### Article browse mode

Article mode remains close to current behavior:

1. Existing timeline list stays intact
2. Existing open-article drawer stays intact
3. Existing source trigger can still open source articles
4. Existing article-level actions stay intact

Any code changes here should be structural only, such as moving the current article-mode UI into a dedicated subcomponent if that improves readability.

### Channel browse mode

Channel mode uses a card/grid list rather than a timeline row list.

Each channel card should show:

1. Channel title
2. A short secondary line:
   - subscriber count
   - recent activity summary
3. Last update time
4. Optional source type / content type badge if available
5. Subscribe state hint

The card should feel intentionally different from article rows so the user understands they are browsing sources, not posts.

Recommended layout:

1. Responsive card grid on desktop
2. Single-column stacked cards on mobile
3. No deep metadata wall; cards should stay scannable

### Channel drawer

When a user clicks a channel card:

1. Open a side drawer
2. Fetch recent articles for that source
3. Show a list of recent articles using the existing feed article/source sheet pattern where practical

The drawer is the inspection surface. The channel list remains the discovery surface.

## Data Design

### New channel explore response

Add a new backend explore endpoint for channel/source discovery. Recommended shape:

`GET /api/v1/feed/explore/sources?sort=popular&page=1&limit=20`

The response should return channel/source list entries for external RSS sources only.

Recommended fields per item:

1. `id`
2. `title`
3. `rss_url`
4. `subscription_count`
5. `recent_item_count`
6. `last_published_at`
7. `subscribed` for the current user when authenticated

Optional fields if cheap to provide:

1. `latest_item_title`
2. `latest_item_published_at`

Do not return full article bodies in the list response.

### Source inclusion rules

The channel browse list should only include sources that are suitable for discovery:

1. `feed_sources.source_type = external_rss`
2. `feed_sources.hidden = false`
3. Source has at least one valid feed item

This keeps the list aligned with the feed module’s public discovery role.

### Channel article fetch

Drawer article loading should query by source identity, not by user subscription identity.

That avoids the current limitation where source-article fetching assumes a subscription id. The drawer must work for anonymous viewers and for sources the current user has not subscribed to.

Recommended direction:

1. Allow fetching by `feed_source_id`
2. Return recent feed items for that source
3. Preserve anonymous read access

## Frontend Architecture

### View decomposition

`FeedRecommendedView.vue` currently mixes page shell, article timeline behavior, source drawer logic, and fetch logic in one file.

This change should improve boundaries while staying scoped:

1. Keep `FeedRecommendedView.vue` as the page container
2. Extract the current article mode into an `ArticleExplorePanel` subcomponent
3. Add `ChannelExplorePanel` or similar for source card mode
4. Reuse `FeedSourceArticlesSheet.vue` if it can support source-based loading semantics cleanly

If reusing `FeedSourceArticlesSheet.vue` becomes awkward because it assumes subscription-based data, extend it carefully rather than duplicating drawer UI.

### Route/query state

Persist the selected explore mode in query state so the page is linkable and stable on refresh.

Recommended query contract:

- `mode=articles`
- `mode=channels`

Article mode may continue to use its existing `sort` and `page` query params.

Channel mode may use:

- `mode=channels`
- `page`

### Type additions

Frontend types need a dedicated channel explore item instead of overloading `FeedArticleSource`.

Recommended new type:

`FeedExploreSource`

Suggested fields:

1. `id`
2. `title`
3. `rssUrl`
4. `subscriptionCount`
5. `recentItemCount`
6. `lastPublishedAt`
7. `subscribed`

This avoids mixing “minimal source identity” with “explore card summary data”.

## Backend Architecture

### New source explore endpoint

The backend currently exposes article explore through `/api/v1/feed/explore`. It does not expose a source/channel explore list.

Add a new endpoint in the feed module for source explore. The handler should:

1. Parse paging/sort params
2. Query eligible external RSS sources
3. Join or aggregate subscription counts
4. Join or aggregate recent activity fields
5. Return a compact source list payload

### Source article query update

Current source-article drawer behavior in the frontend is built around subscription-oriented timeline queries. That is not sufficient for “discover a source I have not subscribed to yet”.

Add or adapt a feed endpoint so source articles can be fetched by `feed_source_id` directly, without requiring a subscription record.

This is a functional requirement for channel browse mode.

## Error Handling

### Channel list

Channel browse mode must not silently collapse into an empty surface when fetching fails.

Provide:

1. Loading skeletons
2. Empty state when no eligible sources exist
3. Error state with retry action when request fails

### Channel drawer

If the channel drawer cannot load articles:

1. Keep the drawer open
2. Show source metadata
3. Show a localized failure message plus retry action

This is better than closing the drawer or showing an empty list with no explanation.

## Testing

### Frontend tests

Add or update tests for:

1. Mode switch rendering and query-state sync
2. Article mode staying functional
3. Channel mode card rendering
4. Clicking a channel opens the drawer
5. Channel drawer fetches and renders source articles
6. Anonymous and authenticated state differences where relevant

### Backend tests

Add coverage for:

1. Source explore endpoint returns only eligible external RSS sources
2. Ordering prefers higher subscription count and then fresher activity
3. Hidden sources are excluded
4. Anonymous access works for explore source list
5. Source article fetch by `feed_source_id` works without a subscription

## Implementation Notes

Recommended rollout order:

1. Introduce backend source explore API and tests
2. Introduce source-based article fetch path if missing
3. Add frontend types and API wiring
4. Split explore page into article mode and channel mode panels
5. Add channel card UI and drawer integration
6. Verify mobile and desktop behavior

This keeps the change incremental and avoids rewriting the existing article mode before the new source data contract exists.
