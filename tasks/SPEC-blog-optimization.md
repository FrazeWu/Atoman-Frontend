# Spec: Blog Optimization

## Objective

Improve the existing Blog and Studio loop without introducing a new top-level module. Readers must be able to retrieve public articles through a stable search contract, understand and control recommendations, and review a subscription digest. Authors must not silently overwrite a newer article and must receive non-blocking publication-quality guidance.

## Scope

- `GET /api/v1/blog/search` searches published public Blog content with query, page, page size, channel, collection, and `relevance` or `recent` sorting. Results include a plain-text match snippet.
- `POST` and `DELETE /api/v1/blog/recommendation-feedback` record and reverse an authenticated reader's hidden-article preference. Recommendations exclude hidden articles.
- `GET /api/v1/blog/digest` returns a deterministic daily or weekly digest limited to the reader's subscribed internal Blog channels. It deliberately does not call an AI provider.
- Article updates accept optional `base_updated_at`. A stale update returns a conflict instead of overwriting current content. Existing clients that omit it remain compatible.
- The editor displays non-blocking warnings for missing summary, cover, structure, or image alt text before publication.

## Commands

- Backend focused test: `cd /root/Atoman/.pi/worktree/atoman-backend-task-01a04751-3f03-72d0-8552-0a1c7d88 && make test-focused PACKAGE=./internal/modules/blog TEST_ARGS='-count=1'`
- Backend build: `cd /root/Atoman/.pi/worktree/atoman-backend-task-01a04751-3f03-72d0-8552-0a1c7d88 && go build ./...`
- Frontend focused tests: `cd /root/Atoman/.pi/worktree/atoman-frontend-task-01a04751-3f03-72d0-8552-0a1c7d88 && bun run test:unit:changed`
- Frontend type check: `cd /root/Atoman/.pi/worktree/atoman-frontend-task-01a04751-3f03-72d0-8552-0a1c7d88 && bun run type-check`

## Compatibility and Boundaries

- Public search must never expose drafts, private posts, follower-only posts, or soft-deleted content.
- The search query remains parameterized. PostgreSQL uses weighted full-text ranking plus `ILIKE` fallback; SQLite test environments use escaped case-insensitive matching.
- Recommendation feedback is reversible and does not modify subscriptions.
- Digest data contains only articles already visible through the reader's internal-channel subscriptions. No article body is sent to a third-party provider.
- `base_updated_at` is optional for backward compatibility, but the new editor always sends it for an existing article.
- Publication warnings guide users; only existing server-side publish rules remain blocking.

## Success Criteria

- Search produces deterministic pagination, correct visibility filtering, snippets, and relevance or recency ordering.
- A hidden recommendation disappears immediately and remains excluded after the next recommendation request.
- An out-of-date editor save receives HTTP 409 without modifying the newer article; the editor offers a clear refresh path.
- A subscribed reader receives an empty, daily, or weekly digest without leaking unsubscribed or private content.
- Warning review is keyboard accessible, reversible, and does not prevent users from publishing.

## Deferred

- External AI providers, model selection, cost management, and generated-content storage require a separately approved provider and operational policy.
- Channel-level muting and advanced personalization require product research after hidden-article feedback has usage data.
