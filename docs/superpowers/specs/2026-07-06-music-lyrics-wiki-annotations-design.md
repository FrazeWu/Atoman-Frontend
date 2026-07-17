# Music Lyrics Wiki and Annotation Design

## Context

The music module already has a player, album drawer, playlist support, song playback state, and editable track lyrics. The player currently opens a lyrics panel, but that panel only shows placeholder text.

The product direction is:

- Lyrics are wiki content.
- Logged-in users can edit song lyrics, translations, and timing.
- Lyrics edits take effect immediately.
- Lyrics changes keep version history and can be reverted.
- Annotations are user submissions, not shared wiki text.
- Annotation authors can create, edit, and delete their own annotations.
- Other users can upvote or downvote annotations.
- Annotation display order is based on net score.

After this lyrics planning work is complete, the next planning task is the notification module.

## Goals

Stage 1 must deliver a complete basic lyrics experience:

1. Open lyrics from the music player.
2. Show rolling lyrics while a song plays.
3. Support original-only and bilingual display.
4. Let logged-in users edit song lyrics in wiki mode.
5. Store lyrics version history.
6. Let users revert lyrics by creating a new version from an older one.
7. Let logged-in users select text in one lyric line and submit an annotation.
8. Let annotation authors edit and delete their own annotations.
9. Let users upvote and downvote annotations.
10. Sort annotations by net score.
11. Detect broken annotation anchors when lyrics are changed.
12. Require lyrics editors to resolve broken anchors before saving.
13. Notify annotation authors when their annotation needs confirmation after a lyric change.

Stage 2 must improve editing efficiency:

1. Provide a row-based lyric editor.
2. Support playback-assisted timestamping.
3. Support dragging and adjusting line times.
4. Support row-level translation editing.
5. Support visual annotation rebinding.
6. Support LRC import and export.

## Product Behavior

The player's lyrics button opens a lyrics panel for the current song.

The lyrics panel displays:

- Song title and artist.
- Original lyrics.
- Optional translation.
- Current playback progress.
- Current lyric line highlight when line timestamps are available.
- Annotated text highlights.

Users can switch between original and bilingual display.

For desktop, selecting or clicking annotated text opens an annotation panel on the right side of the lyrics panel. For mobile, the annotation panel opens from the bottom.

Logged-in users can select text inside a single lyric line and add an annotation for that selected text.

Annotations are anchored to:

- A stable lyric line ID.
- The selected text.
- Start and end offsets within that line.

Lyrics are maintained at song level only. Albums and playlists only provide playback and navigation context.

## Permissions

Lyrics:

- Anonymous users can read lyrics and annotations.
- Logged-in users can create or update lyrics.
- Logged-in users can revert lyrics versions.
- Lyrics updates take effect immediately.
- Every update creates a new version.

Annotations:

- Anonymous users can read annotations.
- Logged-in users can create annotations.
- Annotation authors can edit or soft-delete their own annotations.
- Other users cannot edit or delete another user's annotations.
- Logged-in users can upvote or downvote annotations.
- A user's second vote replaces the previous vote.
- Sending `null` vote cancels the user's vote.

## Annotation Ranking

Annotations for the same selected lyric area are sorted by:

1. Net score, descending: `upvotes - downvotes`.
2. Upvote count, descending.
3. Updated time, descending.
4. Created time, descending.

Negative-score annotations are not deleted automatically. They remain visible but appear later.

## Data Model

Use stable lyric line IDs plus selected-text anchors.

### `music_song_lyrics`

Stores the current effective lyric for a song.

Fields:

- `id`
- `song_id`
- `content`
- `translation`
- `format`: `plain` or `lrc`
- `version`
- `updated_by`
- `edit_summary`
- `created_at`
- `updated_at`

### `music_song_lyric_lines`

Stores parsed current lyric lines.

Fields:

- `id`
- `lyric_id`
- `line_key`
- `line_index`
- `time_ms`
- `text`
- `translation`
- `created_at`
- `updated_at`

`id` is the stable line ID used by annotations.

`line_key` helps migrate lines across versions. It should be derived from timestamp and a normalized text fingerprint when possible.

### `music_song_lyric_versions`

Stores lyric wiki history.

Fields:

- `id`
- `song_id`
- `version`
- `content`
- `translation`
- `format`
- `edit_summary`
- `created_by`
- `created_at`

Reverting creates a new version. It does not overwrite history.

### `music_lyric_annotations`

Stores user annotations.

Fields:

- `id`
- `song_id`
- `line_id`
- `selected_text`
- `start_offset`
- `end_offset`
- `body`
- `created_by`
- `status`: `active`, `needs_rebind`, or `deleted`
- `created_at`
- `updated_at`

Only the annotation author can edit or delete the annotation.

### `music_lyric_annotation_votes`

Stores annotation votes.

Fields:

- `id`
- `annotation_id`
- `user_id`
- `vote`: `up` or `down`
- `created_at`
- `updated_at`

There is one vote per annotation per user.

### Notification Record

Stage 1 needs a minimal notification record for annotation rebind events. If the backend already has a notification system by implementation time, reuse it. Otherwise add a simple music notification table with:

- `id`
- `user_id`
- `type`
- `payload`
- `read_at`
- `created_at`

The notification module will be planned after this lyrics design.

## API Design

### Get Lyrics

`GET /api/v1/music/songs/:songId/lyrics`

Returns current lyrics, parsed lines, annotations, vote counts, and current user's vote state.

### Update Lyrics

`PUT /api/v1/music/songs/:songId/lyrics`

Request:

- `content`
- `translation`
- `format`
- `edit_summary`
- `annotation_resolutions`

Behavior:

- Parse lyric lines.
- Create a new lyric version.
- Update current lyrics.
- Migrate annotation anchors when possible.
- Require explicit resolution for anchors that cannot be matched.

Resolution types:

- `rebind`: bind the annotation to a new `line_id`, `start_offset`, `end_offset`, and `selected_text`.
- `needs_rebind`: mark annotation as needing author confirmation and notify the annotation author.

### List Versions

`GET /api/v1/music/songs/:songId/lyrics/versions`

Returns version history.

### Revert Version

`POST /api/v1/music/songs/:songId/lyrics/versions/:version/revert`

Creates a new current version from the selected older version.

### Create Annotation

`POST /api/v1/music/songs/:songId/lyrics/annotations`

Request:

- `line_id`
- `selected_text`
- `start_offset`
- `end_offset`
- `body`

### Update Annotation

`PATCH /api/v1/music/lyrics/annotations/:annotationId`

Only the annotation author can update `body`.

### Delete Annotation

`DELETE /api/v1/music/lyrics/annotations/:annotationId`

Soft-deletes the annotation. Only the author can delete it.

### Vote Annotation

`PUT /api/v1/music/lyrics/annotations/:annotationId/vote`

Request:

- `vote`: `up`, `down`, or `null`

### Rebind Requests

`GET /api/v1/music/lyrics/annotations/rebind-requests`

Returns annotations created by the current user that need confirmation or rebinding.

## Frontend Design

### Components

`MusicLyricsPanel.vue`

- Main lyrics panel.
- Owns layout, bilingual toggle, annotation side panel or bottom panel, and empty states.

`MusicLyricsLine.vue`

- Renders one lyric line.
- Highlights the current playback line.
- Renders translation when bilingual mode is enabled.
- Highlights annotated text ranges.
- Supports text selection for annotation creation.

`MusicAnnotationPanel.vue`

- Shows annotations for selected lyric text.
- Shows upvote and downvote actions.
- Shows edit and delete actions for the current user's own annotations.

`MusicLyricEditorDrawer.vue`

- Stage 1 lyric wiki editor.
- Supports original lyrics, translation, format selection, edit summary, and anchor conflict resolution.

`MusicAnnotationEditor.vue`

- Create and edit annotation form.

### Composables and Utilities

`useMusicLyrics.ts`

- Fetch lyrics.
- Save lyrics.
- Revert versions.
- Create, update, and delete annotations.
- Vote on annotations.
- Track selected line and selected text.
- Handle anchor conflicts.

`musicLyrics.ts`

- Parse plain lyrics.
- Parse LRC.
- Merge original lyrics and translation.
- Compute current playback line.
- Compute text offsets.
- Validate annotation anchors.
- Attempt automatic anchor migration.

## Interaction Details

When lyrics panel opens:

1. Load current song lyrics.
2. If no lyrics exist, show an empty state and an edit entry for logged-in users.
3. If lyrics exist, render lines.
4. If timestamps exist, scroll the current line near the center while playing.
5. If timestamps do not exist, keep a readable static lyric view.

When a user adds an annotation:

1. User selects text inside one lyric line.
2. The UI opens annotation editor.
3. The request stores line ID, selected text, offsets, and body.
4. The new annotation appears under that selected text.

When a user edits lyrics:

1. User opens wiki editor.
2. User edits content, translation, format, and optional summary.
3. Frontend checks anchor impact if possible.
4. Backend validates again.
5. If anchors are broken, save requires explicit resolutions.
6. Resolved anchors are rebound.
7. Unresolved anchors are marked `needs_rebind` and authors are notified.

## Development Phases

### Stage 1

Build the basic usable loop:

1. Add backend tables and migrations.
2. Add backend services and APIs.
3. Add frontend API client methods.
4. Add lyric parsing utilities and tests.
5. Add lyrics panel and line rendering.
6. Add bilingual toggle.
7. Add annotation display, CRUD, and voting.
8. Add lyric wiki editor.
9. Add version history and revert.
10. Add anchor validation and conflict resolution.
11. Add minimal notification records for rebind requests.
12. Verify with type-check and focused tests.

### Stage 2

Build the advanced editor:

1. Row-based lyric editor.
2. Playback-assisted timestamping.
3. Time dragging and adjustment.
4. Row-level translation editing.
5. Visual annotation rebinding.
6. LRC import and export.
7. Validation for empty lines, duplicate timestamps, and descending timestamps.
8. Integration with the planned notification module.

## Out of Scope for Stage 1

- Word-level timestamps.
- Full community moderation.
- Annotation review queues.
- Annotation comments.
- Rich-text annotations.
- Desktop floating lyrics.
- Image sharing for lyrics.
- Global notification center UI.

## Testing Plan

Backend:

- Migration tests for new tables.
- Service tests for lyric update, version creation, revert, anchor migration, annotation permissions, and votes.
- HTTP tests for all new endpoints.

Frontend:

- Unit tests for `musicLyrics.ts`.
- Component tests for lyrics panel, bilingual display, annotation panel, and editor conflict state.
- Store or integration tests for player current time driving current lyric line.

Verification:

- Run backend build after backend implementation.
- Run frontend type-check after frontend implementation.
- Add focused tests instead of broad unrelated test churn.
