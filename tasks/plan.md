# Implementation Plan: Blog Optimization

## Overview

Deliver the approved Blog optimization initiative in independent vertical slices. Work is tracked in Pi tasks `#5` through `#10`; this document records the dependency order and review boundaries.

## Architecture Decisions

- Add a dedicated Blog search endpoint instead of extending the recommendation endpoint. Search owns pagination, filters, ordering, snippets, and visibility rules.
- Persist only reversible hidden-article feedback. Do not overload subscriptions or add channel muting without behavioral evidence.
- Build a deterministic internal-subscription digest so the UI and privacy contract are ready before any AI-provider decision.
- Use an optional timestamp precondition for article updates to preserve existing API clients while protecting the current editor.
- Keep publication checks client-side and advisory; the server remains authoritative for permissions and publish rules.

## Task List

### Foundation

- [x] Task 5 / Pi `#5`: Define and record compatibility contracts.
- [x] Task 6 / Pi `#6`: Implement Blog search, recommendation feedback, digest, and canonical search indexes; PostgreSQL integration tests pass.

### Reader Flow

- [x] Task 7 / Pi `#7`: Connect Blog Home to search, recommendation reasons, hiding feedback, and digest states; Vitest coverage passes.

### Author Flow

- [x] Task 8 / Pi `#8`: Add optimistic update protection and pre-publication quality review; HTTP and Vitest behavior checks pass.

### Verification

- [x] Task 9 / Pi `#9`: Verify digest behavior within subscription and visibility boundaries.
- [x] Task 10 / Pi `#10`: Run focused tests, type checks, builds, and browser smoke checks (`GET /` returned 200).

## Dependencies

```text
Search index and model migration
  -> Blog search, feedback, and digest API
    -> Blog Home reader UI

Update timestamp contract
  -> editor conflict recovery

Publication-quality utility
  -> editor warning review
```

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Chinese tokenization is not complete under PostgreSQL `simple` text search. | Retain escaped substring fallback and test continuous Chinese matching. |
| Existing clients do not include a concurrency precondition. | Make `base_updated_at` optional while the new editor always sends it. |
| Recommendation preferences could be mistaken for an unsubscribe. | Limit the first slice to a clearly labelled, reversible hidden-article action. |
| Digest could expose content outside a subscription boundary. | Build it exclusively from authenticated internal-channel subscriptions and public posts. |
| No AI provider or privacy policy is configured. | Do not invoke an external provider; keep the digest deterministic and document the deferred dependency. |

## Checkpoints

- After backend API: focused Blog tests and `go build ./...` pass.
- After UI and editor work: related Vitest suite and `bun run type-check` pass.
- Before completion: Blog Home search, recommendation hiding, digest, stale-save conflict, and warning-review paths are exercised in a browser.
