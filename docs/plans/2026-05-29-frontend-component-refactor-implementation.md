# Frontend Component Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Music frontend into layered components that target the backend `/api/v1/music` wiki-edit contract while reducing duplicate Music page logic.

**Architecture:** Add a small API v1 adapter layer, then build Music domain shells from section components and existing A*/Paper UI primitives. Keep route-aware fetching and submission in views/composables, keep section components local and emit-driven, and convert duplicate legacy root views into non-authoritative wrappers or remove them after route verification.

**Tech Stack:** Vue 3, TypeScript strict, Vue Router, Pinia, Vite, Vitest, existing `web/src/components/ui` A*/Paper primitives, backend `/api/v1` contract from `claude/vibrant-antonelli-f3f900:doc/api-v1.md`.

---

## Source documents

Read these before starting implementation:

- `docs/superpowers/specs/2026-05-29-frontend-component-refactor-design.md`
- Backend branch contract: `git show claude/vibrant-antonelli-f3f900:doc/api-v1.md`
- Backend branch design: `git show claude/vibrant-antonelli-f3f900:docs/superpowers/specs/2026-05-29-backend-refactor-design.md`
- Frontend UI rules: `.claude/rules/frontend-ui.md`
- Design system rules: `.claude/rules/design_system.md`

## Planned file structure

### Create

- `web/src/api/types.ts`  
  Shared API envelope, pagination, error, and upload DTO types.

- `web/src/api/client.ts`  
  Small typed fetch wrapper for API v1. It unwraps `{ data, meta }`, preserves `error.code`, and supports JSON and multipart requests.

- `web/src/api/musicV1.ts`  
  Music API v1 adapter. Owns `/api/v1/music/*`, `/api/v1/uploads`, music edit request builders, query serialization, and review actions.

- `web/tests/unit/api/musicV1.spec.ts`  
  Unit tests for endpoint paths, upload purpose values, response unwrapping, edit payload creation, and error preservation.

- `web/src/components/music/CoverDropzone.vue`  
  Paper-style cover upload section. Uses existing A*/Paper primitives and emits uploaded `UploadAsset`.

- `web/src/components/music/AlbumMetaForm.vue`  
  Album metadata form using labels above controls and `PaperField`/A* primitives.

- `web/src/components/music/TrackListEditor.vue`  
  Track list section for song rows, reorder, remove, and local draft edits.

- `web/src/components/music/MusicSourcesEditor.vue`  
  Source URL/title list for `MusicEditRequest.sources`.

- `web/src/components/music/MusicEditReasonBox.vue`  
  Required reason/edit-summary input for music edits.

- `web/src/components/music/MusicDangerZone.vue`  
  Destructive wiki actions as edit submissions, not physical deletes.

- `web/src/components/music/AlbumEditorShell.vue`  
  Domain composition shell for create/update album edits.

- `web/src/components/music/MusicEditReviewShell.vue`  
  Review queue shell for `/api/v1/music/edits` moderation flows.

- `web/tests/unit/views/music/music-api-v1-boundaries.spec.ts`  
  Static boundary tests proving Music views do not reintroduce direct old CRUD endpoints or duplicate `API_URL` constants.

### Modify

- `web/src/composables/useApi.ts`  
  Add API v1 URL helpers without removing old helpers needed by existing modules.

- `web/src/views/music/UploadView.vue`  
  Convert to a canonical create-album edit view using `AlbumEditorShell` and `musicV1` adapter.

- `web/src/views/music/EditAlbumView.vue`  
  Convert to update-album edit semantics using `AlbumEditorShell` and `musicV1` adapter.

- `web/src/views/music/AdminReviewView.vue`  
  Convert review queue to `MusicEditReviewShell` backed by `/api/v1/music/edits`.

- `web/src/router/routes/modules.ts`  
  Verify Music routes still point to `web/src/views/music/*`; add redirects only if a currently reachable duplicate route is found.

- `web/src/views/UploadView.vue`  
  Convert to a thin wrapper/redirect or delete if no route imports it.

- `web/src/views/EditAlbumView.vue`  
  Convert to a thin wrapper/redirect or delete if no route imports it.

- `web/src/views/AdminReviewView.vue`  
  Convert to a thin wrapper/redirect or delete if no route imports it.

---

## Task 1: Add API v1 shared types and client

**Files:**

- Create: `web/src/api/types.ts`
- Create: `web/src/api/client.ts`
- Create: `web/tests/unit/api/musicV1.spec.ts`

- [ ] **Step 1: Write failing tests for envelope unwrapping and error preservation**

Create `web/tests/unit/api/musicV1.spec.ts` with this initial content:

```ts
import { describe, expect, it, vi, afterEach } from 'vitest'
import { ApiErrorResponseError, apiGet, apiPostJson, apiPostMultipart } from '@/api/client'

describe('api v1 client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('unwraps successful data envelopes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { id: 'album_uuid', title: 'Album' }, meta: { source: 'test' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await apiGet<{ id: string; title: string }>('/api/v1/music/albums/album_uuid')

    expect(result).toEqual({ id: 'album_uuid', title: 'Album' })
    expect(fetch).toHaveBeenCalledWith('/api/v1/music/albums/album_uuid', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
  })

  it('throws typed errors while preserving API error code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { code: 'music.entry_protected', message: 'Entry is protected.', details: { role: 'admin' } } }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )))

    await expect(apiPostJson('/api/v1/music/edits', { type: 'update_album' })).rejects.toMatchObject({
      status: 403,
      code: 'music.entry_protected',
      message: 'Entry is protected.',
      details: { role: 'admin' },
    })
  })

  it('posts multipart upload without setting a manual Content-Type header', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { url: '/uploads/cover.png', key: 'music/covers/cover.png', content_type: 'image/png', size: 123 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const form = new FormData()
    form.append('purpose', 'music.cover')

    const result = await apiPostMultipart<{ url: string; key: string; content_type: string; size: number }>('/api/v1/uploads', form)

    expect(result.url).toBe('/uploads/cover.png')
    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' })
    expect((init as RequestInit).headers).toEqual({ Accept: 'application/json' })
  })

  it('exposes ApiErrorResponseError for component error mapping', () => {
    const error = new ApiErrorResponseError(422, 'music.invalid_source', 'Invalid source.', { field: 'sources' })

    expect(error.status).toBe(422)
    expect(error.code).toBe('music.invalid_source')
    expect(error.details).toEqual({ field: 'sources' })
  })
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
cd web && bun run test:unit -- tests/unit/api/musicV1.spec.ts
```

Expected result: FAIL because `@/api/client` does not exist.

- [ ] **Step 3: Add shared API types**

Create `web/src/api/types.ts`:

```ts
export type ApiSuccess<T, M = Record<string, unknown>> = {
  data: T
  meta?: M
}

export type PaginationMeta = {
  page: number
  page_size: number
  total: number
  has_more: boolean
}

export type ApiList<T> = {
  data: T[]
  meta: PaginationMeta
}

export type ApiErrorEnvelope = {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export type UploadPurpose = 'blog.image' | 'music.cover' | 'music.audio'

export type UploadAsset = {
  url: string
  key: string
  content_type: string
  size: number
}
```

- [ ] **Step 4: Add typed API client**

Create `web/src/api/client.ts`:

```ts
import type { ApiErrorEnvelope, ApiSuccess } from './types'

export class ApiErrorResponseError extends Error {
  status: number
  code: string
  details: Record<string, unknown>

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiErrorResponseError'
    this.status = status
    this.code = code
    this.details = details
  }
}

const jsonHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

const multipartHeaders = {
  Accept: 'application/json',
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return {}
  return JSON.parse(text)
}

async function unwrapResponse<T>(response: Response): Promise<T> {
  const payload = await parseJson(response)

  if (!response.ok) {
    const errorPayload = payload as Partial<ApiErrorEnvelope>
    const apiError = errorPayload.error
    throw new ApiErrorResponseError(
      response.status,
      apiError?.code ?? 'system.internal_error',
      apiError?.message ?? 'Request failed.',
      apiError?.details ?? {},
    )
  }

  const success = payload as ApiSuccess<T>
  return success.data
}

export async function apiGet<T>(url: string): Promise<T> {
  return unwrapResponse<T>(await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  }))
}

export async function apiPostJson<T>(url: string, body: unknown): Promise<T> {
  return unwrapResponse<T>(await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  }))
}

export async function apiPatchJson<T>(url: string, body: unknown): Promise<T> {
  return unwrapResponse<T>(await fetch(url, {
    method: 'PATCH',
    credentials: 'include',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  }))
}

export async function apiDeleteJson<T>(url: string, body?: unknown): Promise<T> {
  return unwrapResponse<T>(await fetch(url, {
    method: 'DELETE',
    credentials: 'include',
    headers: jsonHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  }))
}

export async function apiPostMultipart<T>(url: string, body: FormData): Promise<T> {
  return unwrapResponse<T>(await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: multipartHeaders,
    body,
  }))
}
```

- [ ] **Step 5: Run the test again**

Run:

```bash
cd web && bun run test:unit -- tests/unit/api/musicV1.spec.ts
```

Expected result: PASS for the four client tests.

- [ ] **Step 6: Commit**

```bash
git add web/src/api/types.ts web/src/api/client.ts web/tests/unit/api/musicV1.spec.ts
git commit -m "feat(web): add api v1 client primitives"
```

---

## Task 2: Add Music API v1 adapter and edit payload builders

**Files:**

- Create: `web/src/api/musicV1.ts`
- Modify: `web/tests/unit/api/musicV1.spec.ts`
- Modify: `web/src/composables/useApi.ts`

- [ ] **Step 1: Extend tests for Music v1 endpoints and payloads**

Append this to `web/tests/unit/api/musicV1.spec.ts`:

```ts
import {
  buildCreateAlbumEdit,
  buildDeleteAlbumEdit,
  buildUpdateAlbumEdit,
  listMusicAlbums,
  listMusicEdits,
  musicV1Endpoints,
  uploadMusicAsset,
} from '@/api/musicV1'

describe('music v1 adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('builds api v1 endpoint paths', () => {
    expect(musicV1Endpoints.uploads()).toBe('/api/v1/uploads')
    expect(musicV1Endpoints.albums()).toBe('/api/v1/music/albums')
    expect(musicV1Endpoints.album('album_uuid')).toBe('/api/v1/music/albums/album_uuid')
    expect(musicV1Endpoints.edits()).toBe('/api/v1/music/edits')
    expect(musicV1Endpoints.editApprove('edit_uuid')).toBe('/api/v1/music/edits/edit_uuid/approve')
  })

  it('serializes list filters using the api v1 query vocabulary', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [], meta: { page: 1, page_size: 20, total: 0, has_more: false } }), { status: 200 })))

    await listMusicAlbums({ q: 'ambient', status: 'open', page: 1, page_size: 20, sort: '-created_at' })

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/albums?q=ambient&status=open&page=1&page_size=20&sort=-created_at', expect.any(Object))
  })

  it('uploads music cover assets with the correct purpose', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { url: '/uploads/c.png', key: 'music/covers/c.png', content_type: 'image/png', size: 1 } }), { status: 200 })))
    const file = new File(['x'], 'cover.png', { type: 'image/png' })

    await uploadMusicAsset(file, 'music.cover')

    const [, init] = vi.mocked(fetch).mock.calls[0]
    const body = (init as RequestInit).body as FormData
    expect(body.get('purpose')).toBe('music.cover')
    expect(body.get('file')).toBe(file)
  })

  it('builds create album edit payloads instead of direct CRUD payloads', () => {
    const edit = buildCreateAlbumEdit({
      title: 'Album',
      artist_ids: ['artist_uuid'],
      release_date: '2026-05-29',
      cover: { url: '/uploads/c.png', key: 'music/covers/c.png', content_type: 'image/png', size: 1 },
      description: 'Description',
      reason: 'official release information',
      sources: [{ type: 'url', url: 'https://example.com', title: 'Official' }],
    })

    expect(edit).toEqual({
      type: 'create_album',
      entity_type: 'album',
      payload: {
        title: 'Album',
        artist_ids: ['artist_uuid'],
        release_date: '2026-05-29',
        cover_url: '/uploads/c.png',
        cover_key: 'music/covers/c.png',
        description: 'Description',
      },
      changes: {},
      reason: 'official release information',
      sources: [{ type: 'url', url: 'https://example.com', title: 'Official' }],
    })
  })

  it('builds update and delete album edit payloads', () => {
    expect(buildUpdateAlbumEdit('album_uuid', {
      title: 'New title',
      reason: 'metadata correction',
      sources: [],
    })).toEqual({
      type: 'update_album',
      entity_type: 'album',
      entity_id: 'album_uuid',
      payload: {},
      changes: { title: 'New title' },
      reason: 'metadata correction',
      sources: [],
    })

    expect(buildDeleteAlbumEdit('album_uuid', 'duplicate album')).toEqual({
      type: 'delete_album',
      entity_type: 'album',
      entity_id: 'album_uuid',
      payload: {},
      changes: { target_status: 'closed' },
      reason: 'duplicate album',
      sources: [],
    })
  })

  it('lists review edits through /api/v1/music/edits', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [], meta: { page: 1, page_size: 20, total: 0, has_more: false } }), { status: 200 })))

    await listMusicEdits({ status: 'open', entity_type: 'album', page: 1, page_size: 20 })

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/edits?status=open&entity_type=album&page=1&page_size=20', expect.any(Object))
  })
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
cd web && bun run test:unit -- tests/unit/api/musicV1.spec.ts
```

Expected result: FAIL because `@/api/musicV1` does not exist.

- [ ] **Step 3: Implement Music v1 adapter**

Create `web/src/api/musicV1.ts`:

```ts
import { apiGet, apiPostJson, apiPostMultipart } from './client'
import type { PaginationMeta, UploadAsset, UploadPurpose } from './types'

export type MusicEntryStatus = 'open' | 'disputed' | 'confirmed' | 'protected' | 'closed'
export type MusicEntityType = 'artist' | 'album' | 'song'
export type MusicEditStatus = 'open' | 'applied' | 'rejected' | 'cancelled' | 'failed_dependency' | 'failed_prerequisite' | 'reverted' | 'internal_error'
export type MusicEditType =
  | 'create_artist'
  | 'update_artist'
  | 'merge_artist'
  | 'delete_artist'
  | 'create_album'
  | 'update_album'
  | 'merge_album'
  | 'delete_album'
  | 'create_song'
  | 'update_song'
  | 'move_song'
  | 'delete_song'
  | 'update_lyrics'
  | 'change_entry_status'

export type MusicSource = {
  type: 'url' | string
  url?: string
  title?: string
}

export type MusicEditRequest = {
  type: MusicEditType
  entity_type: MusicEntityType
  entity_id?: string
  payload?: Record<string, unknown>
  changes?: Record<string, unknown>
  reason: string
  sources?: MusicSource[]
}

export type MusicEditSummary = {
  id: string
  type: MusicEditType
  status: MusicEditStatus
  entity_type: MusicEntityType
  entity_id?: string
  submitted_by: string
  auto_applied: boolean
  votable: boolean
  votes: { yes: number; no: number }
  created_at: string
}

export type MusicAlbumListItem = {
  id: string
  title: string
  artists?: Array<{ id: string; name: string }>
  release_date?: string
  cover_url?: string
  description?: string
  entry_status: MusicEntryStatus
}

export type MusicListResponse<T> = {
  data: T[]
  meta: PaginationMeta
}

export type MusicListFilters = {
  q?: string
  artist_id?: string
  album_id?: string
  year?: string | number
  status?: MusicEntryStatus
  page?: number
  page_size?: number
  sort?: string
}

export type MusicEditFilters = {
  status?: MusicEditStatus
  entity_type?: MusicEntityType
  type?: MusicEditType
  submitted_by?: string
  page?: number
  page_size?: number
  sort?: string
}

export type AlbumEditDraft = {
  title?: string
  artist_ids?: string[]
  release_date?: string
  cover?: UploadAsset | null
  description?: string
  reason: string
  sources: MusicSource[]
}

const API_V1_BASE = '/api/v1'

function queryString(filters: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ''
}

export const musicV1Endpoints = {
  uploads: () => `${API_V1_BASE}/uploads`,
  artists: () => `${API_V1_BASE}/music/artists`,
  artist: (artistId: string) => `${API_V1_BASE}/music/artists/${artistId}`,
  albums: () => `${API_V1_BASE}/music/albums`,
  album: (albumId: string) => `${API_V1_BASE}/music/albums/${albumId}`,
  songs: () => `${API_V1_BASE}/music/songs`,
  song: (songId: string) => `${API_V1_BASE}/music/songs/${songId}`,
  edits: () => `${API_V1_BASE}/music/edits`,
  edit: (editId: string) => `${API_V1_BASE}/music/edits/${editId}`,
  editVotes: (editId: string) => `${API_V1_BASE}/music/edits/${editId}/votes`,
  editApprove: (editId: string) => `${API_V1_BASE}/music/edits/${editId}/approve`,
  editReject: (editId: string) => `${API_V1_BASE}/music/edits/${editId}/reject`,
  editCancel: (editId: string) => `${API_V1_BASE}/music/edits/${editId}/cancel`,
  editRevert: (editId: string) => `${API_V1_BASE}/music/edits/${editId}/revert`,
}

function albumPayloadFromDraft(draft: AlbumEditDraft): Record<string, unknown> {
  return {
    ...(draft.title !== undefined ? { title: draft.title } : {}),
    ...(draft.artist_ids !== undefined ? { artist_ids: draft.artist_ids } : {}),
    ...(draft.release_date !== undefined ? { release_date: draft.release_date } : {}),
    ...(draft.cover ? { cover_url: draft.cover.url, cover_key: draft.cover.key } : {}),
    ...(draft.description !== undefined ? { description: draft.description } : {}),
  }
}

export function buildCreateAlbumEdit(draft: AlbumEditDraft): MusicEditRequest {
  return {
    type: 'create_album',
    entity_type: 'album',
    payload: albumPayloadFromDraft(draft),
    changes: {},
    reason: draft.reason,
    sources: draft.sources,
  }
}

export function buildUpdateAlbumEdit(albumId: string, draft: AlbumEditDraft): MusicEditRequest {
  return {
    type: 'update_album',
    entity_type: 'album',
    entity_id: albumId,
    payload: {},
    changes: albumPayloadFromDraft(draft),
    reason: draft.reason,
    sources: draft.sources,
  }
}

export function buildDeleteAlbumEdit(albumId: string, reason: string): MusicEditRequest {
  return {
    type: 'delete_album',
    entity_type: 'album',
    entity_id: albumId,
    payload: {},
    changes: { target_status: 'closed' },
    reason,
    sources: [],
  }
}

export async function uploadMusicAsset(file: File, purpose: Extract<UploadPurpose, 'music.cover' | 'music.audio'>): Promise<UploadAsset> {
  const form = new FormData()
  form.append('file', file)
  form.append('purpose', purpose)
  return apiPostMultipart<UploadAsset>(musicV1Endpoints.uploads(), form)
}

export async function listMusicAlbums(filters: MusicListFilters = {}): Promise<MusicListResponse<MusicAlbumListItem>> {
  const url = `${musicV1Endpoints.albums()}${queryString(filters)}`
  const data = await apiGet<MusicAlbumListItem[]>(url)
  return { data, meta: { page: filters.page ?? 1, page_size: filters.page_size ?? data.length, total: data.length, has_more: false } }
}

export async function submitMusicEdit(request: MusicEditRequest): Promise<MusicEditSummary> {
  return apiPostJson<MusicEditSummary>(musicV1Endpoints.edits(), request)
}

export async function listMusicEdits(filters: MusicEditFilters = {}): Promise<MusicListResponse<MusicEditSummary>> {
  const url = `${musicV1Endpoints.edits()}${queryString(filters)}`
  const data = await apiGet<MusicEditSummary[]>(url)
  return { data, meta: { page: filters.page ?? 1, page_size: filters.page_size ?? data.length, total: data.length, has_more: false } }
}

export async function voteMusicEdit(editId: string, vote: 'yes' | 'no', comment = ''): Promise<MusicEditSummary> {
  return apiPostJson<MusicEditSummary>(musicV1Endpoints.editVotes(editId), { vote, comment })
}

export async function approveMusicEdit(editId: string, reason: string): Promise<MusicEditSummary> {
  return apiPostJson<MusicEditSummary>(musicV1Endpoints.editApprove(editId), { reason })
}

export async function rejectMusicEdit(editId: string, reason: string): Promise<MusicEditSummary> {
  return apiPostJson<MusicEditSummary>(musicV1Endpoints.editReject(editId), { reason })
}

export async function cancelMusicEdit(editId: string, reason: string): Promise<MusicEditSummary> {
  return apiPostJson<MusicEditSummary>(musicV1Endpoints.editCancel(editId), { reason })
}

export async function revertMusicEdit(editId: string, reason: string): Promise<MusicEditSummary> {
  return apiPostJson<MusicEditSummary>(musicV1Endpoints.editRevert(editId), { reason })
}
```

- [ ] **Step 4: Add non-breaking API v1 helpers to `useApi.ts`**

Modify `web/src/composables/useApi.ts` by adding this object inside the returned object, after `url: apiUrl,`:

```ts
    v1: {
      url: '/api/v1',
      uploads: '/api/v1/uploads',
      music: {
        artists: '/api/v1/music/artists',
        artist: (id: string) => `/api/v1/music/artists/${id}`,
        albums: '/api/v1/music/albums',
        album: (id: string) => `/api/v1/music/albums/${id}`,
        songs: '/api/v1/music/songs',
        song: (id: string) => `/api/v1/music/songs/${id}`,
        edits: '/api/v1/music/edits',
        edit: (id: string) => `/api/v1/music/edits/${id}`,
      },
    },
```

Keep all existing `/api` helpers because the backend v1 branch may not be merged yet and other modules still use old paths.

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd web && bun run test:unit -- tests/unit/api/musicV1.spec.ts
```

Expected result: PASS.

- [ ] **Step 6: Run type check**

Run:

```bash
cd web && bun run type-check
```

Expected result: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src/api/musicV1.ts web/src/composables/useApi.ts web/tests/unit/api/musicV1.spec.ts
git commit -m "feat(web): add music api v1 adapter"
```

---

## Task 3: Add Music section components

**Files:**

- Create: `web/src/components/music/CoverDropzone.vue`
- Create: `web/src/components/music/AlbumMetaForm.vue`
- Create: `web/src/components/music/TrackListEditor.vue`
- Create: `web/src/components/music/MusicSourcesEditor.vue`
- Create: `web/src/components/music/MusicEditReasonBox.vue`
- Create: `web/src/components/music/MusicDangerZone.vue`

- [ ] **Step 1: Create `CoverDropzone.vue`**

Create `web/src/components/music/CoverDropzone.vue`:

```vue
<template>
  <ASurface class="cover-dropzone" variant="paper" padding="md">
    <div class="cover-dropzone__header">
      <p class="a-font-meta">COVER ASSET</p>
      <PaperReject v-if="asset" size="sm" @click="$emit('clear')">CLEAR</PaperReject>
    </div>

    <div class="cover-dropzone__body">
      <img v-if="previewUrl" :src="previewUrl" alt="Album cover preview" class="cover-dropzone__preview" />
      <AEmpty v-else title="No cover selected" description="Upload a source-backed album cover." />

      <label class="cover-dropzone__picker">
        <input type="file" accept="image/*" class="cover-dropzone__input" :disabled="pending" @change="onFileChange" />
        <PaperPress as="span" size="sm">{{ asset ? 'REPLACE COVER' : 'UPLOAD COVER' }}</PaperPress>
      </label>
    </div>

    <p v-if="error" class="cover-dropzone__error">{{ error }}</p>
  </ASurface>
</template>

<script setup lang="ts">
import ASurface from '@/components/ui/ASurface.vue'
import AEmpty from '@/components/ui/AEmpty.vue'
import PaperPress from '@/components/ui/PaperPress.vue'
import PaperReject from '@/components/ui/PaperReject.vue'
import type { UploadAsset } from '@/api/types'

const props = defineProps<{
  asset: UploadAsset | null
  previewUrl?: string
  pending?: boolean
  error?: string
}>()

const emit = defineEmits<{
  upload: [file: File]
  clear: []
}>()

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  emit('upload', file)
  input.value = ''
}
</script>

<style scoped>
.cover-dropzone {
  display: grid;
  gap: var(--a-space-4);
}

.cover-dropzone__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--a-space-3);
}

.cover-dropzone__body {
  display: grid;
  gap: var(--a-space-3);
}

.cover-dropzone__preview {
  width: 100%;
  max-height: 260px;
  object-fit: cover;
  background: var(--a-color-bg);
  box-shadow: var(--a-shadow-paper-sm);
}

.cover-dropzone__picker {
  display: inline-flex;
  width: fit-content;
}

.cover-dropzone__input {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  opacity: 0;
  pointer-events: none;
}

.cover-dropzone__error {
  color: var(--a-color-danger);
  font-size: var(--a-font-size-sm);
}
</style>
```

- [ ] **Step 2: Create `AlbumMetaForm.vue`**

Create `web/src/components/music/AlbumMetaForm.vue`:

```vue
<template>
  <ASurface class="album-meta-form" variant="paper" padding="md">
    <p class="a-font-meta">ALBUM MANUSCRIPT</p>

    <PaperField label="Title" :error="errors.title">
      <AInput :model-value="draft.title" @update:model-value="update('title', $event)" />
    </PaperField>

    <PaperField label="Artist IDs" hint="Comma-separated artist IDs until artist picker is migrated." :error="errors.artist_ids">
      <AInput :model-value="artistIdsText" @update:model-value="updateArtistIds" />
    </PaperField>

    <PaperField label="Release date" :error="errors.release_date">
      <AInput :model-value="draft.release_date" placeholder="YYYY-MM-DD" @update:model-value="update('release_date', $event)" />
    </PaperField>

    <PaperField label="Description" :error="errors.description">
      <ATextarea :model-value="draft.description" :rows="5" @update:model-value="update('description', $event)" />
    </PaperField>
  </ASurface>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ASurface from '@/components/ui/ASurface.vue'
import AInput from '@/components/ui/AInput.vue'
import ATextarea from '@/components/ui/ATextarea.vue'
import PaperField from '@/components/ui/PaperField.vue'
import type { UploadAsset } from '@/api/types'

export type AlbumMetaDraft = {
  title: string
  artist_ids: string[]
  release_date: string
  cover: UploadAsset | null
  description: string
}

const props = defineProps<{
  draft: AlbumMetaDraft
  errors?: Partial<Record<keyof AlbumMetaDraft, string>>
}>()

const emit = defineEmits<{
  'update:draft': [draft: AlbumMetaDraft]
}>()

const errors = computed(() => props.errors ?? {})
const artistIdsText = computed(() => props.draft.artist_ids.join(', '))

function update<K extends keyof AlbumMetaDraft>(key: K, value: AlbumMetaDraft[K]) {
  emit('update:draft', { ...props.draft, [key]: value })
}

function updateArtistIds(value: string) {
  update('artist_ids', value.split(',').map(item => item.trim()).filter(Boolean))
}
</script>

<style scoped>
.album-meta-form {
  display: grid;
  gap: var(--a-space-4);
}
</style>
```

- [ ] **Step 3: Create `TrackListEditor.vue`**

Create `web/src/components/music/TrackListEditor.vue`:

```vue
<template>
  <ASurface class="track-list-editor" variant="paper" padding="md">
    <div class="track-list-editor__header">
      <p class="a-font-meta">TRACK INDEX</p>
      <PaperPress size="sm" @click="addTrack">ADD TRACK</PaperPress>
    </div>

    <AEmpty v-if="tracks.length === 0" title="No tracks yet" description="Add tracks before submitting this music edit." />

    <ol v-else class="track-list-editor__list">
      <li v-for="(track, index) in tracks" :key="track.local_id" class="track-list-editor__row">
        <span class="track-list-editor__number">{{ index + 1 }}</span>
        <AInput :model-value="track.title" aria-label="Track title" @update:model-value="updateTrack(index, { title: $event })" />
        <AInput :model-value="track.audio_url" aria-label="Audio URL" @update:model-value="updateTrack(index, { audio_url: $event })" />
        <PaperClip size="sm" :disabled="index === 0" @click="moveTrack(index, -1)">UP</PaperClip>
        <PaperClip size="sm" :disabled="index === tracks.length - 1" @click="moveTrack(index, 1)">DOWN</PaperClip>
        <PaperReject size="sm" @click="removeTrack(index)">REMOVE</PaperReject>
      </li>
    </ol>
  </ASurface>
</template>

<script setup lang="ts">
import ASurface from '@/components/ui/ASurface.vue'
import AEmpty from '@/components/ui/AEmpty.vue'
import AInput from '@/components/ui/AInput.vue'
import PaperClip from '@/components/ui/PaperClip.vue'
import PaperPress from '@/components/ui/PaperPress.vue'
import PaperReject from '@/components/ui/PaperReject.vue'

export type TrackDraft = {
  local_id: string
  title: string
  audio_url: string
}

const props = defineProps<{
  tracks: TrackDraft[]
}>()

const emit = defineEmits<{
  'update:tracks': [tracks: TrackDraft[]]
}>()

function addTrack() {
  emit('update:tracks', [
    ...props.tracks,
    { local_id: `track-${Date.now()}`, title: '', audio_url: '' },
  ])
}

function updateTrack(index: number, patch: Partial<TrackDraft>) {
  emit('update:tracks', props.tracks.map((track, current) => current === index ? { ...track, ...patch } : track))
}

function moveTrack(index: number, direction: -1 | 1) {
  const next = [...props.tracks]
  const target = index + direction
  if (target < 0 || target >= next.length) return
  const [track] = next.splice(index, 1)
  next.splice(target, 0, track)
  emit('update:tracks', next)
}

function removeTrack(index: number) {
  emit('update:tracks', props.tracks.filter((_, current) => current !== index))
}
</script>

<style scoped>
.track-list-editor {
  display: grid;
  gap: var(--a-space-4);
}

.track-list-editor__header,
.track-list-editor__row {
  display: flex;
  align-items: center;
  gap: var(--a-space-3);
}

.track-list-editor__list {
  display: grid;
  gap: var(--a-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.track-list-editor__number {
  min-width: 2ch;
  font-family: var(--a-font-mono);
  font-weight: 800;
}
</style>
```

- [ ] **Step 4: Create `MusicSourcesEditor.vue`**

Create `web/src/components/music/MusicSourcesEditor.vue`:

```vue
<template>
  <ASurface class="music-sources-editor" variant="paper" padding="md">
    <div class="music-sources-editor__header">
      <p class="a-font-meta">SOURCES</p>
      <PaperPress size="sm" @click="addSource">ADD SOURCE</PaperPress>
    </div>

    <AEmpty v-if="sources.length === 0" title="No sources attached" description="Add at least one source for reviewable music edits." />

    <div v-for="(source, index) in sources" :key="index" class="music-sources-editor__row">
      <AInput :model-value="source.title ?? ''" placeholder="Source title" aria-label="Source title" @update:model-value="updateSource(index, { title: $event })" />
      <AInput :model-value="source.url ?? ''" placeholder="https://" aria-label="Source URL" @update:model-value="updateSource(index, { type: 'url', url: $event })" />
      <PaperReject size="sm" @click="removeSource(index)">REMOVE</PaperReject>
    </div>
  </ASurface>
</template>

<script setup lang="ts">
import ASurface from '@/components/ui/ASurface.vue'
import AEmpty from '@/components/ui/AEmpty.vue'
import AInput from '@/components/ui/AInput.vue'
import PaperPress from '@/components/ui/PaperPress.vue'
import PaperReject from '@/components/ui/PaperReject.vue'
import type { MusicSource } from '@/api/musicV1'

const props = defineProps<{ sources: MusicSource[] }>()
const emit = defineEmits<{ 'update:sources': [sources: MusicSource[]] }>()

function addSource() {
  emit('update:sources', [...props.sources, { type: 'url', url: '', title: '' }])
}

function updateSource(index: number, patch: Partial<MusicSource>) {
  emit('update:sources', props.sources.map((source, current) => current === index ? { ...source, ...patch } : source))
}

function removeSource(index: number) {
  emit('update:sources', props.sources.filter((_, current) => current !== index))
}
</script>

<style scoped>
.music-sources-editor {
  display: grid;
  gap: var(--a-space-4);
}

.music-sources-editor__header,
.music-sources-editor__row {
  display: flex;
  align-items: center;
  gap: var(--a-space-3);
}
</style>
```

- [ ] **Step 5: Create `MusicEditReasonBox.vue`**

Create `web/src/components/music/MusicEditReasonBox.vue`:

```vue
<template>
  <PaperField label="Edit reason" :error="error" hint="Explain why this wiki edit should be accepted.">
    <ATextarea :model-value="modelValue" :rows="4" @update:model-value="$emit('update:modelValue', $event)" />
  </PaperField>
</template>

<script setup lang="ts">
import ATextarea from '@/components/ui/ATextarea.vue'
import PaperField from '@/components/ui/PaperField.vue'

defineProps<{
  modelValue: string
  error?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
```

- [ ] **Step 6: Create `MusicDangerZone.vue`**

Create `web/src/components/music/MusicDangerZone.vue`:

```vue
<template>
  <ASurface class="music-danger-zone" variant="paper" padding="md">
    <p class="a-font-meta">DANGER ZONE</p>
    <p class="music-danger-zone__copy">
      This does not physically delete the entity. It submits a wiki edit that closes the entry after review.
    </p>
    <PaperReject :disabled="pending" @click="$emit('submit-close-edit')">SUBMIT CLOSE EDIT</PaperReject>
  </ASurface>
</template>

<script setup lang="ts">
import ASurface from '@/components/ui/ASurface.vue'
import PaperReject from '@/components/ui/PaperReject.vue'

defineProps<{ pending?: boolean }>()
defineEmits<{ 'submit-close-edit': [] }>()
</script>

<style scoped>
.music-danger-zone {
  display: grid;
  gap: var(--a-space-3);
}

.music-danger-zone__copy {
  margin: 0;
  color: var(--a-color-text-muted);
}
</style>
```

- [ ] **Step 7: Run type check**

Run:

```bash
cd web && bun run type-check
```

Expected result: PASS. If a UI primitive does not support a prop used above, adapt the component to the actual primitive API while preserving the same public component props and events.

- [ ] **Step 8: Commit**

```bash
git add web/src/components/music/CoverDropzone.vue web/src/components/music/AlbumMetaForm.vue web/src/components/music/TrackListEditor.vue web/src/components/music/MusicSourcesEditor.vue web/src/components/music/MusicEditReasonBox.vue web/src/components/music/MusicDangerZone.vue
git commit -m "feat(web): add music edit section components"
```

---

## Task 4: Add AlbumEditorShell domain component

**Files:**

- Create: `web/src/components/music/AlbumEditorShell.vue`

- [ ] **Step 1: Create shell component**

Create `web/src/components/music/AlbumEditorShell.vue`:

```vue
<template>
  <div class="album-editor-shell">
    <APageHeader
      :title="mode === 'create' ? 'Submit album edit' : 'Submit album update'"
      :description="mode === 'create' ? 'Create a reviewable wiki edit for a new album.' : 'Submit metadata changes through the Music edit system.'"
    />

    <AlbumMetaForm :draft="draft.meta" :errors="errors.meta" @update:draft="updateMeta" />
    <CoverDropzone
      :asset="draft.meta.cover"
      :preview-url="draft.meta.cover?.url || existingCoverUrl"
      :pending="uploadPending"
      :error="errors.cover"
      @upload="$emit('upload-cover', $event)"
      @clear="clearCover"
    />
    <TrackListEditor :tracks="draft.tracks" @update:tracks="updateTracks" />
    <MusicSourcesEditor :sources="draft.sources" @update:sources="updateSources" />
    <MusicEditReasonBox v-model="reasonProxy" :error="errors.reason" />

    <div class="album-editor-shell__actions">
      <PaperPress :disabled="pending" @click="$emit('submit')">
        {{ pending ? 'SUBMITTING EDIT' : 'SUBMIT EDIT' }}
      </PaperPress>
      <PaperClip @click="$emit('cancel')">CANCEL</PaperClip>
    </div>

    <MusicDangerZone v-if="mode === 'update'" :pending="pending" @submit-close-edit="$emit('submit-close-edit')" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import APageHeader from '@/components/ui/APageHeader.vue'
import PaperClip from '@/components/ui/PaperClip.vue'
import PaperPress from '@/components/ui/PaperPress.vue'
import AlbumMetaForm, { type AlbumMetaDraft } from './AlbumMetaForm.vue'
import CoverDropzone from './CoverDropzone.vue'
import MusicDangerZone from './MusicDangerZone.vue'
import MusicEditReasonBox from './MusicEditReasonBox.vue'
import MusicSourcesEditor from './MusicSourcesEditor.vue'
import TrackListEditor, { type TrackDraft } from './TrackListEditor.vue'
import type { MusicSource } from '@/api/musicV1'

export type AlbumEditorDraft = {
  meta: AlbumMetaDraft
  tracks: TrackDraft[]
  sources: MusicSource[]
  reason: string
}

export type AlbumEditorErrors = {
  meta?: Partial<Record<keyof AlbumMetaDraft, string>>
  cover?: string
  reason?: string
}

const props = defineProps<{
  mode: 'create' | 'update'
  draft: AlbumEditorDraft
  pending?: boolean
  uploadPending?: boolean
  existingCoverUrl?: string
  errors?: AlbumEditorErrors
}>()

const emit = defineEmits<{
  'update:draft': [draft: AlbumEditorDraft]
  'upload-cover': [file: File]
  submit: []
  cancel: []
  'submit-close-edit': []
}>()

const errors = computed(() => props.errors ?? {})

const reasonProxy = computed({
  get: () => props.draft.reason,
  set: reason => emit('update:draft', { ...props.draft, reason }),
})

function updateMeta(meta: AlbumMetaDraft) {
  emit('update:draft', { ...props.draft, meta })
}

function clearCover() {
  updateMeta({ ...props.draft.meta, cover: null })
}

function updateTracks(tracks: TrackDraft[]) {
  emit('update:draft', { ...props.draft, tracks })
}

function updateSources(sources: MusicSource[]) {
  emit('update:draft', { ...props.draft, sources })
}
</script>

<style scoped>
.album-editor-shell {
  display: grid;
  gap: var(--a-space-5);
}

.album-editor-shell__actions {
  display: flex;
  align-items: center;
  gap: var(--a-space-3);
  justify-content: flex-end;
}
</style>
```

- [ ] **Step 2: Run type check**

Run:

```bash
cd web && bun run type-check
```

Expected result: PASS. If `APageHeader` prop names differ, adapt the shell to the existing `APageHeader.vue` API instead of changing `APageHeader`.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/music/AlbumEditorShell.vue
git commit -m "feat(web): add album editor shell"
```

---

## Task 5: Refactor Music UploadView to submit create_album edits

**Files:**

- Modify: `web/src/views/music/UploadView.vue`
- Test: `web/tests/unit/views/music/music-api-v1-boundaries.spec.ts`

- [ ] **Step 1: Add static boundary test for UploadView**

Create `web/tests/unit/views/music/music-api-v1-boundaries.spec.ts`:

```ts
import path from 'node:path'
import { readFileSync } from 'node:fs'

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

describe('music api v1 boundaries', () => {
  it('UploadView submits through music edits instead of direct album or song CRUD', () => {
    const source = read('src/views/music/UploadView.vue')

    expect(source).toContain('AlbumEditorShell')
    expect(source).toContain('buildCreateAlbumEdit')
    expect(source).toContain('submitMusicEdit')
    expect(source).not.toContain('`${api.url}/songs`')
    expect(source).not.toContain('`${api.url}/albums`')
    expect(source).not.toContain('POST /albums')
  })
})
```

- [ ] **Step 2: Run failing boundary test**

Run:

```bash
cd web && bun run test:unit -- tests/unit/views/music/music-api-v1-boundaries.spec.ts
```

Expected result: FAIL because `UploadView.vue` still uses old direct endpoints and does not import the shell.

- [ ] **Step 3: Replace `UploadView.vue` with shell-based create edit view**

Modify `web/src/views/music/UploadView.vue` to this shape. Preserve any route-specific wrappers or auth checks already required by the current file, but the central submission path must match this code:

```vue
<template>
  <main class="music-edit-page">
    <AlbumEditorShell
      mode="create"
      :draft="draft"
      :pending="submitPending"
      :upload-pending="uploadPending"
      :errors="errors"
      @update:draft="draft = $event"
      @upload-cover="uploadCover"
      @submit="submitCreateAlbumEdit"
      @cancel="router.back()"
    />
  </main>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AlbumEditorShell, { type AlbumEditorDraft, type AlbumEditorErrors } from '@/components/music/AlbumEditorShell.vue'
import { ApiErrorResponseError } from '@/api/client'
import { buildCreateAlbumEdit, submitMusicEdit, uploadMusicAsset } from '@/api/musicV1'

const router = useRouter()
const submitPending = ref(false)
const uploadPending = ref(false)
const errors = ref<AlbumEditorErrors>({})

const draft = ref<AlbumEditorDraft>({
  meta: {
    title: '',
    artist_ids: [],
    release_date: '',
    cover: null,
    description: '',
  },
  tracks: [],
  sources: [],
  reason: '',
})

function validateDraft(): boolean {
  const nextErrors: AlbumEditorErrors = { meta: {} }
  if (!draft.value.meta.title.trim()) nextErrors.meta!.title = 'Album title is required.'
  if (draft.value.meta.artist_ids.length === 0) nextErrors.meta!.artist_ids = 'At least one artist is required.'
  if (!draft.value.reason.trim()) nextErrors.reason = 'Explain why this edit should be accepted.'
  errors.value = nextErrors
  return Object.keys(nextErrors.meta ?? {}).length === 0 && !nextErrors.reason
}

async function uploadCover(file: File) {
  uploadPending.value = true
  errors.value = { ...errors.value, cover: undefined }
  try {
    const cover = await uploadMusicAsset(file, 'music.cover')
    draft.value = { ...draft.value, meta: { ...draft.value.meta, cover } }
  } catch (error) {
    errors.value = {
      ...errors.value,
      cover: error instanceof ApiErrorResponseError ? error.message : 'Cover upload failed.',
    }
  } finally {
    uploadPending.value = false
  }
}

async function submitCreateAlbumEdit() {
  if (!validateDraft()) return
  submitPending.value = true
  try {
    const request = buildCreateAlbumEdit({
      title: draft.value.meta.title,
      artist_ids: draft.value.meta.artist_ids,
      release_date: draft.value.meta.release_date,
      cover: draft.value.meta.cover,
      description: draft.value.meta.description,
      reason: draft.value.reason,
      sources: draft.value.sources,
    })
    const edit = await submitMusicEdit(request)
    await router.push(`/admin/review?edit=${edit.id}`)
  } catch (error) {
    errors.value = {
      ...errors.value,
      reason: error instanceof ApiErrorResponseError ? error.message : 'Failed to submit album edit.',
    }
  } finally {
    submitPending.value = false
  }
}
</script>

<style scoped>
.music-edit-page {
  max-width: 1080px;
  margin: 0 auto;
  padding: var(--a-space-6);
}
</style>
```

Remove old `handleSubmit`, direct `${api.url}/songs`, direct `${api.url}/albums`, and admin-only create-album direct CRUD logic from this view. That old behavior conflicts with the API v1 wiki-edit contract.

- [ ] **Step 4: Run focused tests**

Run:

```bash
cd web && bun run test:unit -- tests/unit/views/music/music-api-v1-boundaries.spec.ts tests/unit/api/musicV1.spec.ts
```

Expected result: PASS.

- [ ] **Step 5: Run type check**

Run:

```bash
cd web && bun run type-check
```

Expected result: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/views/music/UploadView.vue web/tests/unit/views/music/music-api-v1-boundaries.spec.ts
git commit -m "feat(web): submit music uploads as album edits"
```

---

## Task 6: Refactor Music EditAlbumView to submit update_album and close edits

**Files:**

- Modify: `web/src/views/music/EditAlbumView.vue`
- Modify: `web/tests/unit/views/music/music-api-v1-boundaries.spec.ts`

- [ ] **Step 1: Extend boundary test for EditAlbumView**

Append this test to `web/tests/unit/views/music/music-api-v1-boundaries.spec.ts`:

```ts
  it('EditAlbumView submits update and close edits instead of direct PUT or DELETE album CRUD', () => {
    const source = read('src/views/music/EditAlbumView.vue')

    expect(source).toContain('AlbumEditorShell')
    expect(source).toContain('buildUpdateAlbumEdit')
    expect(source).toContain('buildDeleteAlbumEdit')
    expect(source).toContain('submitMusicEdit')
    expect(source).not.toContain('method: \'PUT\'')
    expect(source).not.toContain('method: "PUT"')
    expect(source).not.toContain('method: \'DELETE\'')
    expect(source).not.toContain('method: "DELETE"')
  })
```

Place it inside the existing `describe('music api v1 boundaries', () => { ... })` block.

- [ ] **Step 2: Run failing boundary test**

Run:

```bash
cd web && bun run test:unit -- tests/unit/views/music/music-api-v1-boundaries.spec.ts
```

Expected result: FAIL because `EditAlbumView.vue` still uses direct update logic.

- [ ] **Step 3: Replace direct edit flow with shell-based update edit flow**

Modify `web/src/views/music/EditAlbumView.vue` so the central structure is:

```vue
<template>
  <main class="music-edit-page">
    <AlbumEditorShell
      mode="update"
      :draft="draft"
      :pending="submitPending"
      :upload-pending="uploadPending"
      :existing-cover-url="existingCoverUrl"
      :errors="errors"
      @update:draft="draft = $event"
      @upload-cover="uploadCover"
      @submit="submitUpdateAlbumEdit"
      @submit-close-edit="submitCloseAlbumEdit"
      @cancel="router.back()"
    />
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AlbumEditorShell, { type AlbumEditorDraft, type AlbumEditorErrors } from '@/components/music/AlbumEditorShell.vue'
import { ApiErrorResponseError, apiGet } from '@/api/client'
import { buildDeleteAlbumEdit, buildUpdateAlbumEdit, musicV1Endpoints, submitMusicEdit, uploadMusicAsset, type MusicAlbumListItem } from '@/api/musicV1'

const route = useRoute()
const router = useRouter()
const albumId = String(route.params.albumId ?? '')
const submitPending = ref(false)
const uploadPending = ref(false)
const existingCoverUrl = ref('')
const errors = ref<AlbumEditorErrors>({})

const draft = ref<AlbumEditorDraft>({
  meta: {
    title: '',
    artist_ids: [],
    release_date: '',
    cover: null,
    description: '',
  },
  tracks: [],
  sources: [],
  reason: '',
})

onMounted(async () => {
  const album = await apiGet<MusicAlbumListItem>(musicV1Endpoints.album(albumId))
  existingCoverUrl.value = album.cover_url ?? ''
  draft.value = {
    ...draft.value,
    meta: {
      title: album.title,
      artist_ids: album.artists?.map(artist => artist.id) ?? [],
      release_date: album.release_date ?? '',
      cover: null,
      description: album.description ?? '',
    },
  }
})

function validateReason(): boolean {
  if (draft.value.reason.trim()) return true
  errors.value = { ...errors.value, reason: 'Explain why this edit should be accepted.' }
  return false
}

async function uploadCover(file: File) {
  uploadPending.value = true
  errors.value = { ...errors.value, cover: undefined }
  try {
    const cover = await uploadMusicAsset(file, 'music.cover')
    draft.value = { ...draft.value, meta: { ...draft.value.meta, cover } }
  } catch (error) {
    errors.value = { ...errors.value, cover: error instanceof ApiErrorResponseError ? error.message : 'Cover upload failed.' }
  } finally {
    uploadPending.value = false
  }
}

async function submitUpdateAlbumEdit() {
  if (!validateReason()) return
  submitPending.value = true
  try {
    const edit = await submitMusicEdit(buildUpdateAlbumEdit(albumId, {
      title: draft.value.meta.title,
      artist_ids: draft.value.meta.artist_ids,
      release_date: draft.value.meta.release_date,
      cover: draft.value.meta.cover,
      description: draft.value.meta.description,
      reason: draft.value.reason,
      sources: draft.value.sources,
    }))
    await router.push(`/admin/review?edit=${edit.id}`)
  } catch (error) {
    errors.value = { ...errors.value, reason: error instanceof ApiErrorResponseError ? error.message : 'Failed to submit album update edit.' }
  } finally {
    submitPending.value = false
  }
}

async function submitCloseAlbumEdit() {
  if (!validateReason()) return
  submitPending.value = true
  try {
    const edit = await submitMusicEdit(buildDeleteAlbumEdit(albumId, draft.value.reason))
    await router.push(`/admin/review?edit=${edit.id}`)
  } catch (error) {
    errors.value = { ...errors.value, reason: error instanceof ApiErrorResponseError ? error.message : 'Failed to submit close edit.' }
  } finally {
    submitPending.value = false
  }
}
</script>

<style scoped>
.music-edit-page {
  max-width: 1080px;
  margin: 0 auto;
  padding: var(--a-space-6);
}
</style>
```

Keep any route fallback logic only if current tests or routes require it. If keeping fallback logic, the submit path must still use `buildUpdateAlbumEdit` and `submitMusicEdit`.

- [ ] **Step 4: Run focused tests**

Run:

```bash
cd web && bun run test:unit -- tests/unit/views/music/music-api-v1-boundaries.spec.ts tests/unit/api/musicV1.spec.ts
```

Expected result: PASS.

- [ ] **Step 5: Run type check**

Run:

```bash
cd web && bun run type-check
```

Expected result: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/views/music/EditAlbumView.vue web/tests/unit/views/music/music-api-v1-boundaries.spec.ts
git commit -m "feat(web): submit album updates as music edits"
```

---

## Task 7: Add MusicEditReviewShell and refactor AdminReviewView

**Files:**

- Create: `web/src/components/music/MusicEditReviewShell.vue`
- Modify: `web/src/views/music/AdminReviewView.vue`
- Modify: `web/tests/unit/views/music/music-api-v1-boundaries.spec.ts`

- [ ] **Step 1: Extend boundary test for AdminReviewView**

Append inside the existing `describe` block:

```ts
  it('AdminReviewView uses the music edit review shell and v1 edit actions', () => {
    const source = read('src/views/music/AdminReviewView.vue')

    expect(source).toContain('MusicEditReviewShell')
    expect(source).toContain('listMusicEdits')
    expect(source).toContain('approveMusicEdit')
    expect(source).toContain('rejectMusicEdit')
    expect(source).not.toContain('/admin/reviews/songs')
    expect(source).not.toContain('/admin/reviews/album-corrections')
  })
```

- [ ] **Step 2: Run failing boundary test**

Run:

```bash
cd web && bun run test:unit -- tests/unit/views/music/music-api-v1-boundaries.spec.ts
```

Expected result: FAIL because current AdminReviewView still uses old admin review endpoints.

- [ ] **Step 3: Create review shell**

Create `web/src/components/music/MusicEditReviewShell.vue`:

```vue
<template>
  <div class="music-edit-review-shell">
    <APageHeader title="Music edit review" description="Review wiki edits submitted through /api/v1/music/edits." />

    <div class="music-edit-review-shell__filters">
      <ASelect :model-value="status" :options="statusOptions" @update:model-value="$emit('update:status', $event as MusicEditStatus | '')" />
      <ASelect :model-value="entityType" :options="entityOptions" @update:model-value="$emit('update:entityType', $event as MusicEntityType | '')" />
    </div>

    <AEmpty v-if="edits.length === 0" title="No edits in this queue" description="Music edit submissions will appear here." />

    <div v-else class="music-edit-review-shell__list">
      <PaperEntry v-for="edit in edits" :key="edit.id">
        <template #meta>{{ edit.type }} · {{ edit.status }} · {{ edit.created_at }}</template>
        <template #title>{{ edit.entity_type }} edit</template>
        <template #description>
          Votes: {{ edit.votes.yes }} yes / {{ edit.votes.no }} no
        </template>
        <template #actions>
          <PaperPress size="sm" :disabled="pendingId === edit.id" @click="$emit('approve', edit.id)">APPROVE</PaperPress>
          <PaperReject size="sm" :disabled="pendingId === edit.id" @click="$emit('reject', edit.id)">REJECT</PaperReject>
          <PaperClip size="sm" :disabled="pendingId === edit.id" @click="$emit('cancel', edit.id)">CANCEL</PaperClip>
          <PaperClip size="sm" :disabled="pendingId === edit.id" @click="$emit('revert', edit.id)">REVERT</PaperClip>
        </template>
      </PaperEntry>
    </div>
  </div>
</template>

<script setup lang="ts">
import AEmpty from '@/components/ui/AEmpty.vue'
import APageHeader from '@/components/ui/APageHeader.vue'
import ASelect from '@/components/ui/ASelect.vue'
import PaperClip from '@/components/ui/PaperClip.vue'
import PaperEntry from '@/components/ui/PaperEntry.vue'
import PaperPress from '@/components/ui/PaperPress.vue'
import PaperReject from '@/components/ui/PaperReject.vue'
import type { MusicEditStatus, MusicEditSummary, MusicEntityType } from '@/api/musicV1'

defineProps<{
  edits: MusicEditSummary[]
  status: MusicEditStatus | ''
  entityType: MusicEntityType | ''
  pendingId?: string
}>()

defineEmits<{
  'update:status': [status: MusicEditStatus | '']
  'update:entityType': [entityType: MusicEntityType | '']
  approve: [editId: string]
  reject: [editId: string]
  cancel: [editId: string]
  revert: [editId: string]
}>()

const statusOptions = [
  { label: 'All statuses', value: '' },
  { label: 'Open', value: 'open' },
  { label: 'Applied', value: 'applied' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Cancelled', value: 'cancelled' },
]

const entityOptions = [
  { label: 'All entities', value: '' },
  { label: 'Artist', value: 'artist' },
  { label: 'Album', value: 'album' },
  { label: 'Song', value: 'song' },
]
</script>

<style scoped>
.music-edit-review-shell {
  display: grid;
  gap: var(--a-space-5);
}

.music-edit-review-shell__filters {
  display: flex;
  align-items: center;
  gap: var(--a-space-3);
}

.music-edit-review-shell__list {
  display: grid;
  gap: var(--a-space-4);
}
</style>
```

- [ ] **Step 4: Replace AdminReviewView with v1 review adapter**

Modify `web/src/views/music/AdminReviewView.vue` to centralize on the shell:

```vue
<template>
  <main class="music-review-page">
    <MusicEditReviewShell
      :edits="edits"
      :status="status"
      :entity-type="entityType"
      :pending-id="pendingId"
      @update:status="status = $event; fetchEdits()"
      @update:entity-type="entityType = $event; fetchEdits()"
      @approve="approve"
      @reject="reject"
      @cancel="cancel"
      @revert="revert"
    />
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import MusicEditReviewShell from '@/components/music/MusicEditReviewShell.vue'
import {
  approveMusicEdit,
  cancelMusicEdit,
  listMusicEdits,
  rejectMusicEdit,
  revertMusicEdit,
  type MusicEditStatus,
  type MusicEditSummary,
  type MusicEntityType,
} from '@/api/musicV1'

const edits = ref<MusicEditSummary[]>([])
const status = ref<MusicEditStatus | ''>('open')
const entityType = ref<MusicEntityType | ''>('')
const pendingId = ref<string>()

async function fetchEdits() {
  const result = await listMusicEdits({
    status: status.value || undefined,
    entity_type: entityType.value || undefined,
    page: 1,
    page_size: 50,
    sort: '-created_at',
  })
  edits.value = result.data
}

async function withPending(editId: string, action: () => Promise<unknown>) {
  pendingId.value = editId
  try {
    await action()
    await fetchEdits()
  } finally {
    pendingId.value = undefined
  }
}

function approve(editId: string) {
  return withPending(editId, () => approveMusicEdit(editId, 'source verified'))
}

function reject(editId: string) {
  return withPending(editId, () => rejectMusicEdit(editId, 'source is not reliable'))
}

function cancel(editId: string) {
  return withPending(editId, () => cancelMusicEdit(editId, 'invalid open edit'))
}

function revert(editId: string) {
  return withPending(editId, () => revertMusicEdit(editId, 'applied edit needs reversal'))
}

onMounted(fetchEdits)
</script>

<style scoped>
.music-review-page {
  max-width: 1080px;
  margin: 0 auto;
  padding: var(--a-space-6);
}
</style>
```

If current admin page contains entry-management UI that must be preserved, move it behind a separate route or section after the v1 edit queue works. Do not keep old `/admin/reviews/*` review queue calls in this page.

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd web && bun run test:unit -- tests/unit/views/music/music-api-v1-boundaries.spec.ts tests/unit/api/musicV1.spec.ts
```

Expected result: PASS.

- [ ] **Step 6: Run type check**

Run:

```bash
cd web && bun run type-check
```

Expected result: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/music/MusicEditReviewShell.vue web/src/views/music/AdminReviewView.vue web/tests/unit/views/music/music-api-v1-boundaries.spec.ts
git commit -m "feat(web): review music edits through api v1"
```

---

## Task 8: Resolve duplicate root-level Music views

**Files:**

- Modify or delete: `web/src/views/UploadView.vue`
- Modify or delete: `web/src/views/EditAlbumView.vue`
- Modify or delete: `web/src/views/AdminReviewView.vue`
- Modify: `web/tests/unit/views/music/music-api-v1-boundaries.spec.ts`

- [ ] **Step 1: Confirm duplicate files are not imported by routes**

Run:

```bash
cd web && rg "@/views/(UploadView|EditAlbumView|AdminReviewView)|views/(UploadView|EditAlbumView|AdminReviewView)" src tests
```

Expected result: no route imports for the root-level files. If imports exist, list each importing file and convert those imports to `@/views/music/*` before deleting root-level files.

- [ ] **Step 2: Add static test preventing accidental reintroduction of root-level Music page logic**

Append inside `web/tests/unit/views/music/music-api-v1-boundaries.spec.ts`:

```ts
  it('keeps root-level legacy music views non-authoritative', () => {
    const rootUpload = read('src/views/UploadView.vue')
    const rootEdit = read('src/views/EditAlbumView.vue')
    const rootReview = read('src/views/AdminReviewView.vue')

    expect(rootUpload).toContain('@/views/music/UploadView.vue')
    expect(rootEdit).toContain('@/views/music/EditAlbumView.vue')
    expect(rootReview).toContain('@/views/music/AdminReviewView.vue')
    expect(rootUpload).not.toContain('fetch(')
    expect(rootEdit).not.toContain('fetch(')
    expect(rootReview).not.toContain('fetch(')
  })
```

- [ ] **Step 3: Run failing test**

Run:

```bash
cd web && bun run test:unit -- tests/unit/views/music/music-api-v1-boundaries.spec.ts
```

Expected result: FAIL because root-level files still contain legacy logic.

- [ ] **Step 4: Convert root-level files to wrappers**

Replace `web/src/views/UploadView.vue` with:

```vue
<template>
  <MusicUploadView />
</template>

<script setup lang="ts">
import MusicUploadView from '@/views/music/UploadView.vue'
</script>
```

Replace `web/src/views/EditAlbumView.vue` with:

```vue
<template>
  <MusicEditAlbumView />
</template>

<script setup lang="ts">
import MusicEditAlbumView from '@/views/music/EditAlbumView.vue'
</script>
```

Replace `web/src/views/AdminReviewView.vue` with:

```vue
<template>
  <MusicAdminReviewView />
</template>

<script setup lang="ts">
import MusicAdminReviewView from '@/views/music/AdminReviewView.vue'
</script>
```

This wrapper approach is safer than deletion for the first pass because unknown external links or lazy imports fail less dramatically. A later cleanup can delete them once repo-wide search and QA prove they are unused.

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd web && bun run test:unit -- tests/unit/views/music/music-api-v1-boundaries.spec.ts
```

Expected result: PASS.

- [ ] **Step 6: Run router tests**

Run:

```bash
cd web && bun run test:unit -- tests/unit/router/router.root-entry.spec.ts
```

Expected result: PASS, proving root entry behavior remains valid.

- [ ] **Step 7: Commit**

```bash
git add web/src/views/UploadView.vue web/src/views/EditAlbumView.vue web/src/views/AdminReviewView.vue web/tests/unit/views/music/music-api-v1-boundaries.spec.ts
git commit -m "refactor(web): make legacy music views thin wrappers"
```

---

## Task 9: Preserve Music loading boundary and run full frontend verification

**Files:**

- Modify only if tests reveal direct fallout.

- [ ] **Step 1: Run Music loading boundary test**

Run:

```bash
cd web && bun run test:unit -- tests/unit/views/music/music-loading.spec.ts
```

Expected result: PASS. This protects the existing delayed song bootstrap behavior in `HomeView.vue` and lazy player audio creation.

- [ ] **Step 2: Run all unit tests**

Run:

```bash
cd web && bun run test:unit
```

Expected result: PASS.

- [ ] **Step 3: Run type check**

Run:

```bash
cd web && bun run type-check
```

Expected result: PASS.

- [ ] **Step 4: Run build**

Run:

```bash
cd web && bun run build
```

Expected result: PASS and Vite build completes.

- [ ] **Step 5: Manual verification with backend dependency noted**

If backend API v1 is not merged into the current working branch, record this exact verification limitation in the implementation summary:

```text
Manual API verification blocked: backend /api/v1 endpoints are specified on claude/vibrant-antonelli-f3f900 but are not available in this frontend worktree. Verified with unit tests, type-check, and build. Runtime API verification must run after backend v1 is merged or served.
```

If backend API v1 is available, manually verify these flows:

```text
1. Navigate to the Music module album creation route.
2. Upload a cover and confirm POST /api/v1/uploads uses purpose=music.cover.
3. Submit a new album and confirm POST /api/v1/music/edits uses type=create_album.
4. Navigate to album edit route and submit metadata change as type=update_album.
5. Submit close/delete action and confirm type=delete_album or change_entry_status.
6. Open admin review and confirm GET /api/v1/music/edits loads queue.
7. Approve/reject an edit and confirm POST /api/v1/music/edits/:editId/approve or reject.
```

- [ ] **Step 6: Commit verification-only fixes if needed**

If verification required code fixes, commit them:

```bash
git add <fixed-files>
git commit -m "fix(web): stabilize music api v1 refactor"
```

If no fixes were needed, do not create an empty commit.

---

## Task 10: Update implementation notes in the spec if reality differs

**Files:**

- Modify if needed: `docs/superpowers/specs/2026-05-29-frontend-component-refactor-design.md`
- Create or modify if needed: `docs/superpowers/plans/2026-05-29-frontend-component-refactor-implementation.md`

- [ ] **Step 1: Compare implementation with spec decisions**

Check these spec commitments:

```text
- Music writes use /api/v1/music/edits.
- Uploads use /api/v1/uploads with purpose=music.cover or music.audio.
- Duplicate root-level Music views no longer contain authoritative logic.
- UI uses existing A*/Paper primitives.
- No /music route prefix is introduced.
```

- [ ] **Step 2: Update spec only for architecture/product changes**

If implementation changed an architecture decision, update `docs/superpowers/specs/2026-05-29-frontend-component-refactor-design.md` with the actual decision. Example patch language:

```markdown
### Implementation adjustment

During implementation, root-level legacy Music views were kept as thin wrappers for compatibility rather than deleted. They are non-authoritative and import the canonical `web/src/views/music/*` views.
```

If implementation followed the plan exactly, do not edit the spec.

- [ ] **Step 3: Commit doc adjustments if made**

```bash
git add docs/superpowers/specs/2026-05-29-frontend-component-refactor-design.md docs/superpowers/plans/2026-05-29-frontend-component-refactor-implementation.md
git commit -m "docs: align frontend refactor plan with implementation"
```

Only run this commit if files changed.

---

## Self-review checklist

Spec coverage:

- Layered component architecture: Tasks 3, 4, 5, 6, 7.
- Music first slice: Tasks 5, 6, 7, 8.
- Backend API v1 alignment: Tasks 1, 2, 5, 6, 7.
- Uploads via `/api/v1/uploads`: Tasks 1, 2, 3, 5, 6.
- Music edit semantics: Tasks 2, 5, 6, 7.
- Duplicate Music views: Task 8.
- Error-code preservation: Task 1 and component error handling in Tasks 5 and 6.
- Testing and acceptance: Tasks 1 through 9.

Placeholder scan:

- The plan contains no unfinished placeholder markers.
- The plan contains no deferred-work markers.
- The plan contains no vague future-implementation steps.
- Every task has exact paths, commands, and expected results.

Type consistency:

- `UploadAsset` is defined in `web/src/api/types.ts` and reused by Music components.
- `MusicEditRequest`, `MusicEditSummary`, and edit builder names are defined in `web/src/api/musicV1.ts` before views use them.
- `AlbumEditorDraft` and `AlbumEditorErrors` are exported from `AlbumEditorShell.vue` before views import them.
- `TrackDraft` is exported from `TrackListEditor.vue` before `AlbumEditorShell.vue` imports it.
