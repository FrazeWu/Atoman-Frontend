# Music Module Wiki Flow Deep QA Design

## Context

The music module currently has enough pieces to suggest a larger workflow, but the user-facing flow is not coherent yet. The artist creation page exists, the artist and album drawers still contain placeholder content, and the v1 music API adapter contains edit/review concepts that conflict with the product decision for this work.

Product decision: music is a wiki-style module. Logged-in users can directly create and edit artists and albums. The main path must not require review queues, voting, or administrator approval.

## Goal

Deeply test and fix the music module so a real user can complete the wiki flow:

1. Register a test user.
2. Create an artist.
3. Create an album for that artist.
4. Upload real audio from `Downloads/2049`.
5. Play the uploaded music.
6. Edit artist information.
7. Edit album information.
8. See changes immediately.

The final real-backend verification runs against `localhost:8080` and keeps the generated test data.

## Strategy

Use a two-stage verification strategy.

### Stage 1: Mocked frontend QA

Use Playwright with mocked API responses to isolate frontend behavior from backend state. This stage must prove that the UI, route structure, form state, upload controls, and player state work without blank screens.

Coverage:

- Register a test user through the frontend path or through the same auth store behavior.
- Visit the music home page.
- Create an artist.
- Create an album.
- Add tracks and attach audio files.
- Click play and verify the visible player state.
- Edit artist details and verify the updated details render.
- Edit album details and verify the updated details render.

This stage should fail fast on blank pages by checking real headings, fields, buttons, and state changes instead of only checking that `body` is visible.

### Stage 2: Real backend QA

Run a second Playwright flow against the real backend at `localhost:8080`.

The test should:

- Register a uniquely named user such as `e2e-music-<timestamp>@atoman.test`.
- Use real files from `Downloads/2049` for the Kanye album fixture.
- Create a unique artist and album name using the same timestamp.
- Upload real audio and, if present, cover art.
- Play at least one uploaded track.
- Edit the artist and album.
- Confirm the edited values are visible after save or page refresh.

The test data should remain in the database for later manual inspection.

## User-facing behavior

### Music home

`/` shows the artist list. It must never render as a blank page.

If there are no artists, show a clear empty state and a visible "新建艺术家" entry point. If artists exist, each artist row/card opens a real artist detail view.

### Create artist

`/artist/new` shows a form with at least:

- Artist name.
- Bio or description.

A logged-in user can submit the form. On success, the user lands on the created artist detail or returns to the artist list where the new artist is visible.

### Artist detail and edit

The artist detail view shows real backend data:

- Artist name.
- Bio or description.
- Album list.

The edit action opens a real form, not a placeholder drawer. Saving updates the artist immediately and refreshes the visible detail/list state.

### Create album

The album creation entry point is available from an artist detail page.

The form supports:

- Album title.
- Release date or year.
- Description.
- Cover upload when a cover file exists.
- Track list.
- Audio upload for each track.

The user should experience this as one album creation flow, even if the backend requires multiple API calls internally.

### Album detail, edit, and playback

The album detail view shows real backend data:

- Album title.
- Artist.
- Cover if available.
- Release information.
- Description.
- Track list.

Playback actions:

- Play album.
- Play a single track.

The player must show the current song and artist and enter a playing/loading state. The verification does not need to assert that sound comes out of the machine speaker, only that the browser loads the audio and the app state reflects playback.

The album edit action opens a real form. Saving updates the album immediately and refreshes visible state.

## API contract

The frontend should use direct wiki-style endpoints for the main flow.

### Auth

- Register: `POST /api/v1/auth/register`.
- Login/session state remains in the existing auth store.

### Artists

Expected wiki endpoints:

- List: `GET /api/v1/music/artists` or the currently supported artist list endpoint.
- Create: `POST /api/v1/music/artists`.
- Detail: `GET /api/v1/music/artists/:id`.
- Update: `PUT` or `PATCH /api/v1/music/artists/:id`.

The main path must not submit artist changes to `music/edits`.

### Albums

Expected wiki endpoints:

- Create: `POST /api/v1/music/albums`.
- Detail: `GET /api/v1/music/albums/:id`.
- Update: `PUT` or `PATCH /api/v1/music/albums/:id`.

Album creation should associate the album with the artist via the backend-supported field, likely `artist_ids` or equivalent.

If the real backend only supports edit/review endpoints and not direct wiki updates, the real-backend QA result should report an API contract blocker. The frontend should not silently fall back to an approval workflow.

### Uploads and tracks

Uploads should use `/api/v1/uploads` with these purposes:

- `music.cover` for cover files.
- `music.audio` for audio files.

Album creation carries track data including title, order, and returned audio URL/key. If the backend requires songs to be created separately and then attached to the album, the frontend can adapt internally while keeping the user-facing flow as a single album creation experience.

## Error handling

- Required fields show field-level Chinese errors.
- 401 redirects to login or displays "请先登录".
- Backend 4xx errors show the server message when available.
- Upload failures preserve form data and allow retry.
- Network failures show a visible error and never blank the page.
- Conflicts during wiki saves are displayed as backend errors. The MVP does not implement conflict merging.

## Testing plan

### Unit tests

Add or update unit tests for:

- API payload builders for direct artist/album wiki create and update calls.
- Artist create/edit form submission behavior.
- Album create/edit form submission behavior.
- Player store behavior when playing uploaded track data.
- Empty states for music pages.

### Playwright mock e2e

Add a deterministic mocked flow that covers registration, artist creation, album creation, upload controls, playback state, artist edit, and album edit.

The mock flow should assert specific visible text and state transitions. It must not rely on arbitrary timeouts as the primary success signal.

### Playwright real-backend e2e

Add a real-backend flow that uses `localhost:8080` and `Downloads/2049`.

Preflight checks:

- Backend is reachable.
- The `Downloads/2049` directory exists.
- At least one audio file exists.
- Cover file is optional but reported if absent.

Success criteria:

- Test user registered.
- Artist created and visible.
- Album created and visible under the artist.
- Audio uploaded.
- Playback UI shows the uploaded track.
- Artist edit is visible after save.
- Album edit is visible after save.

## Out of scope

- Administrator review queues.
- Voting on music edits.
- Complex multi-user conflict merge UI.
- Data cleanup after real-backend runs.
- Guaranteeing audible speaker output during automated tests.

## Implementation notes

- Existing placeholder drawers should either be replaced by real detail/edit components or routed to real pages. Keeping placeholder content in the main wiki flow is not acceptable.
- Existing v1 edit helpers can remain for other future workflows, but they should not drive this wiki flow.
- The implementation should prefer current A* and Paper UI primitives and follow the paper/ink design system.
