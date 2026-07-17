# Frontend Component Refactor Design

Date: 2026-05-29
Status: Draft approved for planning

Visual precedence: component boundaries and API responsibilities in this document remain valid. Visual tokens, icons, focus behavior, and Sheet stack mechanics follow [the approved global UI specification](./2026-06-05-flat-paper-ui-design.md). In particular, the former text-only close-control rule is superseded: familiar close and back actions may use Lucide icon-only controls with a Tooltip and `aria-label`.

## 1. Background

Atoman's frontend has accumulated large view files and repeated UI patterns across modules. The most visible pressure points are:

- `web/src/views/blog/PostEditorView.vue` and `web/src/views/timeline/TimelineHomeView.vue` are very large views with mixed layout, state, forms, and business behavior.
- Music has repeated page implementations such as root-level music views and `web/src/views/music/*` views.
- Some modules use `PaperSidebar` and Paper UI primitives, while others still use local sidebar and form patterns.
- The paper-and-ink design system already exists, but not every module is built from the same component layers.

This design establishes a layered frontend component model and uses the Music module as the first vertical slice. The first slice must align with the backend API v1 refactor from branch `claude/vibrant-antonelli-f3f900`, especially:

- `docs/superpowers/specs/2026-05-29-backend-refactor-design.md`
- `doc/api-v1.md`

## 2. Goals

- Define a reusable frontend layering model: route/page shell, domain composition, section components, and UI primitives.
- Use Music as the first implementation slice because it has clear duplicate views and strong backend API changes.
- Reduce duplicated Music page and form/upload/list code without changing user-visible behavior beyond the API v1 semantics.
- Align Music UI with `/api/v1/music` as a public wiki database where writes go through music edits.
- Preserve the paper-and-ink visual system: pure white surfaces, Paper actions, Paper fields, and sheet-style secondary interactions.
- Produce a spec that can be turned into an implementation plan before any code changes.

## 3. Non-goals

- Do not rewrite the entire frontend in one pass.
- Do not refactor Blog, Timeline, Forum, Video, Feed, or Debate implementation in the first slice except where shared primitives are defined for Music and future reuse.
- Do not introduce Naive UI or another large UI component library.
- Do not change backend behavior or define new API paths outside the API v1 contract.
- Do not restore `/blog`, `/music`, or other module-prefix routes that conflict with the project routing rule.
- Do not keep Music as direct album/song CRUD in the new design. Music writes must be modeled as music edits.

## 4. Target Component Architecture

```text
Route Layer
  canonical Music route tree
  legacy duplicate entries deleted or converted to thin redirects

Page Shell Layer
  MusicLayout / shared ModuleShell
  sidebar, page paper, router-view, page-level spacing

Domain Composition Layer
  MusicUploadFlow
  AlbumEditorShell
  MusicEditReviewShell
  MusicEntityDetailShell

Section Layer
  MusicAlbumMetaSection
  MusicCoverSection
  MusicTracksSection
  MusicSourcesSection
  MusicReviewNotesSection

UI Primitive Layer
  ASurface
  APageHeader
  AEmpty
  PaperField
  PaperSheet
  PaperPress
  PaperReject
  PaperClip
  PaperEntry
```

Layer rules:

- Route layer decides which view is canonical. It must not duplicate business logic across two view files.
- Page shell components own module layout and visual framing, not API calls.
- Domain composition components assemble a use case, such as submitting an album edit.
- Section components edit local draft state and emit changes upward.
- UI primitives render style and interaction affordances only.

## 5. Music First Slice

The first slice uses the Music module because it has direct opportunities to reduce code:

- duplicate upload/edit/admin-review views can be consolidated;
- cover upload, audio upload, track list editing, album metadata, and destructive confirmation patterns can be extracted;
- the backend API v1 refactor changes Music from direct CRUD to a wiki edit model, so frontend code needs an explicit API alignment layer.

The selected approach is **Canonical Shell**:

1. Identify the canonical Music route and view files.
2. Remove duplicate logic from non-canonical entries by deleting them or converting them to thin route redirects/wrappers.
3. Introduce domain shells such as `AlbumEditorShell` and `MusicEditReviewShell`.
4. Extract repeated sections such as `MusicCoverSection`, `MusicTracksSection`, and `MusicAlbumMetaSection`.
5. Keep behavior aligned with API v1 and verify with type-check, lint, and manual Music flows.

## 6. Backend API v1 Alignment

The frontend must target the API v1 contract from `doc/api-v1.md` on branch `claude/vibrant-antonelli-f3f900`.

### 6.1 Global API conventions

All new Music-facing frontend API code should use:

```text
/api/v1
```

Responses use envelopes:

```ts
type ApiSuccess<T, M = Record<string, unknown>> = {
  data: T
  meta?: M
}

type ApiList<T> = {
  data: T[]
  meta: {
    page: number
    page_size: number
    total: number
    has_more: boolean
  }
}

type ApiError = {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}
```

The frontend API layer should unwrap success responses and preserve `error.code` for UI-specific handling.

### 6.2 Uploads

Shared upload endpoint:

```text
POST /api/v1/uploads
```

Permission: `user` and above.

Multipart fields:

```text
file
purpose = blog.image | music.cover | music.audio
```

Music components use these purposes:

- `CoverDropzone` uses `music.cover`.
- audio upload sections use `music.audio`.

Upload response:

```ts
type UploadAsset = {
  url: string
  key: string
  content_type: string
  size: number
}
```

Business components reference uploaded media by `url` or `key`. They must not care whether storage is local or S3.

### 6.3 Public Music reads

Public read endpoints:

```text
GET /api/v1/music/artists
GET /api/v1/music/artists/:artistId
GET /api/v1/music/albums
GET /api/v1/music/albums/:albumId
GET /api/v1/music/songs
GET /api/v1/music/songs/:songId
```

Permission: `anonymous`.

Common filters:

```text
q
artist_id
album_id
year
status=open|disputed|confirmed|protected|closed
page
page_size
sort
```

Frontend implications:

- Music lists and detail pages can be read without login.
- Filters and pagination must use the API v1 query vocabulary.
- Components should display `entry_status` rather than old direct status assumptions.

### 6.4 Music edits

All Music writes go through:

```text
POST /api/v1/music/edits
```

Permission: `user` and above.

Initial edit types:

```text
create_artist
update_artist
merge_artist
delete_artist
create_album
update_album
merge_album
delete_album
create_song
update_song
move_song
delete_song
update_lyrics
change_entry_status
```

Frontend implications:

- `AlbumEditorShell` does not directly save an album with `POST /albums` or `PUT /albums/:id`.
- Creating an album submits a `create_album` edit.
- Editing an album submits an `update_album` edit.
- Deleting or closing an album submits a `delete_album` or `change_entry_status` edit.
- Song operations submit `create_song`, `update_song`, `move_song`, or `delete_song` edits.
- The UI copy should say “submit edit”, “edit submitted”, “waiting for review”, or “applied” instead of always saying “saved”.

A frontend edit request shape should preserve the API contract:

```ts
type MusicEditRequest = {
  type: MusicEditType
  entity_type: 'artist' | 'album' | 'song'
  entity_id?: string
  payload?: Record<string, unknown>
  changes?: Record<string, unknown>
  reason: string
  sources?: Array<{
    type: 'url' | string
    url?: string
    title?: string
  }>
}
```

### 6.5 Music edit review and moderation

Review and moderation endpoints:

```text
GET  /api/v1/music/edits
GET  /api/v1/music/edits/:editId
POST /api/v1/music/edits/:editId/votes
POST /api/v1/music/edits/:editId/approve
POST /api/v1/music/edits/:editId/reject
POST /api/v1/music/edits/:editId/cancel
POST /api/v1/music/edits/:editId/revert
```

Frontend implications:

- A `MusicEditReviewShell` should be separate from album/song editor sections.
- Review queue filters should use `status`, `entity_type`, `type`, `submitted_by`, `page`, `page_size`, and `sort`.
- Buttons are role-aware:
  - users can submit edits and vote;
  - submitters can cancel own open edits;
  - moderators and above can approve/reject/cancel invalid edits;
  - moderators and above can revert applied edits.
- Admin fast approval still creates edit, decision, and audit log. The UI must not model admin changes as direct table updates.

### 6.6 Error codes

Music UI must handle these API error codes with stable messages or field-level mapping where appropriate:

```text
music.entity_not_found
music.artist_not_found
music.album_not_found
music.song_not_found
music.edit_not_found
music.edit_not_open
music.edit_forbidden
music.edit_invalid_type
music.edit_invalid_transition
music.edit_dependency_failed
music.vote_forbidden
music.entry_protected
music.invalid_entry_status_transition
music.invalid_source
music.annotation_not_found
music.annotation_forbidden
validation.invalid_request
auth.unauthorized
auth.forbidden
storage.unsupported_file_type
storage.file_too_large
storage.not_configured
system.internal_error
```

Examples:

- `music.entry_protected`: show that protected entries require higher review or admin approval.
- `music.invalid_source`: highlight the sources section.
- `storage.file_too_large`: show upload-specific error inside `CoverDropzone` or audio upload section.
- `auth.unauthorized`: prompt login before submitting edits.

## 7. Component Responsibilities

### 7.1 `AlbumEditorShell`

Purpose:

- Compose album metadata, cover upload, track editing, sources, reason, and submit actions.
- Support create and update modes.
- Express edit submission semantics rather than direct save semantics.

Inputs:

- `mode: 'create' | 'update'`
- `draft`
- `pending`
- `errors`
- optional existing entity summary

Outputs:

- `submit-edit`
- `update:draft`
- `cancel`

It should not call APIs directly unless the implementation plan explicitly decides to place API orchestration inside a composable used by the shell.

### 7.2 `MusicAlbumMetaSection`

Purpose:

- Render album title, artists, release date, and album type fields.
- Reuse `ArtistSelect`, `AInput`, and `ASelect` instead of page-local controls.
- Emit local draft updates without calling APIs directly.

### 7.3 `MusicCoverSection`

Purpose:

- Select, preview, replace, and clear album cover assets.
- Use `POST /api/v1/uploads` through the parent view or shell.
- Show upload state locally while keeping storage branching out of the component.

### 7.4 `MusicTracksSection`

Purpose:

- Display and edit song rows for album-related edits.
- Support reorder, remove, and basic track-number editing.
- Emit changes without calling Music APIs directly.

### 7.5 `MusicSourcesSection`

Purpose:

- Collect structured source title and URL rows for `MusicEditRequest.sources`.
- Keep source list editing local and emit-driven.

### 7.6 `MusicReviewNotesSection`

Purpose:

- Capture edit summary and review rationale separately.
- Keep wording aligned with the wiki edit workflow.

## 8. Data Flow

Use one-way data flow:

```text
View
  reads route params
  loads data with API adapters
  owns loading/error/submit state
  handles navigation and toast
    ↓ props
Domain Shell
  assembles sections
  exposes use-case events
    ↓ props / ↑ emits
Section Components
  edit local draft slices
  show local validation/upload state
    ↑ update events
View or composable
  builds API v1 request
  calls upload/edit/read adapter
```

Rules:

- View layer owns route, fetch, submit, navigation, and global errors.
- Shell layer knows the use-case mode, not the route path.
- Section components do not depend on URL paths.
- UI primitives do not know Music concepts.
- A composable such as `useMusicEditDraft` may be introduced if it reduces repeated draft transformation logic, but it must stay scoped and testable.

## 9. Routing and Duplicate View Strategy

The implementation plan must first inspect `web/src/router.ts` and current Music route entries.

Design intent:

- Pick one canonical route/view for Music upload/edit/admin-review flows.
- Remove duplicate logic from non-canonical files.
- If old route entries are still needed for compatibility, they should redirect to the canonical route or mount a thin wrapper with no duplicated business logic.
- Do not introduce module-prefix paths that violate the project rule that module, user, and channel space are determined by subdomain.

## 10. Error Handling, Empty States, and Feedback

- Page-level loading and fetch errors are owned by views.
- Shells receive state and render the correct paper surface.
- Section components show local field errors and upload errors.
- Empty track lists use `AEmpty` plus a lightweight action to add or upload tracks.
- Destructive actions continue to use confirmation or explicit secondary actions, depending on whether the flow is a local draft removal or a submitted wiki edit.
- Close and back controls follow the global icon rule: familiar Lucide icons may appear without visible text when a Tooltip and `aria-label` are present.
- Backgrounds and surfaces must remain pure white or approved cold-gray wash; avoid warm/yellow backgrounds.

## 11. Testing and Acceptance

Static validation:

```bash
cd web && bun run type-check && bun run lint
```

Manual behavior validation:

- Music read pages load albums, songs, and artists through `/api/v1/music/*` adapters once backend v1 is available.
- Cover upload uses `POST /api/v1/uploads` with `purpose=music.cover`.
- Audio upload uses `POST /api/v1/uploads` with `purpose=music.audio`.
- Creating an album submits a `create_album` edit.
- Updating an album submits an `update_album` edit.
- Deleting or closing an entity submits an edit and does not present itself as immediate physical deletion.
- Review queue actions map to vote/approve/reject/cancel/revert endpoints.
- API envelope errors display meaningful messages and preserve `error.code`.

Code-structure acceptance:

- Music duplicate view logic is removed or reduced to thin wrappers.
- Large Music views no longer directly contain cover upload, track list editing, album metadata form, confirmation UI, and API orchestration all in one file.
- Extracted sections are reusable inside create/update flows.
- Paper UI primitives remain the visual foundation.

## 12. Risks and Mitigations

### Risk: Backend API v1 is on another branch

Mitigation:

- Treat `doc/api-v1.md` from `claude/vibrant-antonelli-f3f900` as the contract for design and planning.
- During implementation, either merge/rebase backend API docs into the working branch first or copy the contract into the frontend plan as an explicit dependency.

### Risk: Current frontend still uses old API paths

Mitigation:

- Introduce API adapters so the v1 transition is isolated.
- Do not scatter `/api/v1/music` paths across components.

### Risk: Wiki edit semantics change UI copy

Mitigation:

- Make edit submission semantics explicit in shells and actions.
- Avoid labels such as “Save album” when the backend creates a reviewable edit.

### Risk: Over-abstraction

Mitigation:

- Extract only components backed by real duplicate Music code.
- Keep components scoped to Music until reuse is proven.
- Promote to shared UI only when a second module adopts the pattern.

## 13. Open Implementation Questions for the Plan

These are not design blockers, but the implementation plan must answer them after reading code:

1. Which current Music route/view is canonical after inspecting `web/src/router.ts`?
2. Which duplicate root-level Music views can be deleted versus converted to wrappers?
3. Does the current auth store expose enough role information for user/moderator/admin action gating?
4. Should API v1 DTOs live in `web/src/types.ts`, a new `web/src/api/types.ts`, or module-local Music API files?
5. Is backend API v1 already runnable in the implementation branch, or should the frontend first land adapters and type boundaries behind existing calls?

## 14. Approval

The design was reviewed interactively with visual companion screens. The approved decisions are:

- Use a layered frontend component blueprint.
- First phase is foundation plus one vertical slice.
- The vertical slice is Music.
- The Music approach is Canonical Shell.
- Music frontend design must align with backend API v1 and wiki edit semantics.
