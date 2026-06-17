# Music Module Wiki Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the music module a working wiki-style flow where a normal logged-in user can create artists, create albums with real audio, play music, and edit artist/album data with immediate visible updates.

**Architecture:** Add a direct wiki API adapter for music artists/albums/uploads, then replace placeholder music drawers with real data-backed views and forms. Verify first with deterministic Playwright mock API coverage, then with a real-backend Playwright flow against `localhost:8080` using `Downloads/2049` and retained test data.

**Tech Stack:** Vue 3.5, TypeScript, Pinia, Vue Router, Vitest, Vue Test Utils, Playwright, existing A* / Paper UI primitives, `/api/v1` backend endpoints.

---

## File Structure

### API and types

- Modify: `src/api/musicV1.ts`
  - Add direct wiki CRUD helpers for artists and albums.
  - Keep existing edit/review helpers, but do not use them in the wiki flow.
- Modify: `tests/unit/api/musicV1.spec.ts`
  - Add tests for direct artist/album create, detail, update, upload, and list payloads.

### Music views and components

- Modify: `src/views/music/HomeView.vue`
  - Use v1 music artist list endpoint.
  - Render loading, empty, error, and artist list states.
  - Route or open details using real artist ids.
- Modify: `src/views/music/CreateArtistView.vue`
  - Use direct wiki create endpoint.
  - Redirect to real artist detail after create.
- Create: `src/views/music/ArtistDetailView.vue`
  - Data-backed artist detail with album list and edit action.
- Create: `src/views/music/EditArtistView.vue`
  - Data-backed artist edit form.
- Create: `src/views/music/CreateAlbumView.vue`
  - Album creation form for artist, cover, tracks, audio uploads.
- Create: `src/views/music/AlbumDetailView.vue`
  - Data-backed album detail, track list, and playback actions.
- Create: `src/views/music/EditAlbumView.vue`
  - Data-backed album edit form.
- Create: `src/components/music/MusicArtistForm.vue`
  - Shared artist create/edit form.
- Create: `src/components/music/MusicAlbumForm.vue`
  - Shared album create/edit form.
- Modify: `src/router/routes/modules.ts`
  - Add routes for artist detail/edit and album create/detail/edit under the music module.
- Modify: `src/components/music/ArtistDrawer.vue`
  - Remove placeholder dependency from the main wiki path or convert actions to router links.
- Modify: `src/components/music/AlbumDrawer.vue`
  - Remove placeholder dependency from the main wiki path or convert actions to router links.
- Modify: `src/components/music/NestedActionDrawer.vue`
  - Remove placeholder forms from the main wiki path or leave only non-primary actions.

### Tests

- Create: `tests/unit/views/music/MusicArtistForm.spec.ts`
- Create: `tests/unit/views/music/MusicAlbumForm.spec.ts`
- Modify: `tests/unit/views/music/MusicHomeView.spec.ts`
- Create: `tests/unit/views/music/ArtistDetailView.spec.ts`
- Create: `tests/unit/views/music/AlbumDetailView.spec.ts`
- Modify: `tests/unit/stores/player.spec.ts`
- Create: `tests/e2e/specs/music-wiki.mock.spec.ts`
- Create: `tests/e2e/specs/music-wiki.real.spec.ts`
- Create: `tests/e2e/helpers/music-fixtures.ts`

---

## Task 1: Add direct wiki API helpers

**Files:**
- Modify: `src/api/musicV1.ts`
- Modify: `tests/unit/api/musicV1.spec.ts`

- [ ] **Step 1: Write failing tests for artist wiki endpoints**

Append this block inside `describe('music v1 adapter', () => { ... })` in `tests/unit/api/musicV1.spec.ts`:

```ts
it('creates artists through direct wiki endpoints', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ data: { id: 'artist_uuid', name: 'Kanye West', bio: 'Artist bio', entry_status: 'open' } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))

  const { createMusicArtist } = await import('@/api/musicV1')
  const result = await createMusicArtist({ name: 'Kanye West', bio: 'Artist bio' })

  expect(fetch).toHaveBeenCalledWith('/api/v1/music/artists', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ name: 'Kanye West', bio: 'Artist bio' }),
  })
  expect(result).toEqual({ id: 'artist_uuid', name: 'Kanye West', bio: 'Artist bio', entry_status: 'open' })
})

it('updates artists through direct wiki endpoints', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ data: { id: 'artist_uuid', name: 'Ye', bio: 'Updated bio', entry_status: 'open' } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))

  const { updateMusicArtist } = await import('@/api/musicV1')
  const result = await updateMusicArtist('artist_uuid', { name: 'Ye', bio: 'Updated bio' })

  expect(fetch).toHaveBeenCalledWith('/api/v1/music/artists/artist_uuid', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ name: 'Ye', bio: 'Updated bio' }),
  })
  expect(result.name).toBe('Ye')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
bun run test:unit -- tests/unit/api/musicV1.spec.ts
```

Expected: FAIL with missing exports `createMusicArtist` and `updateMusicArtist`.

- [ ] **Step 3: Add artist wiki types and helpers**

Add this code to `src/api/musicV1.ts` after `MusicAlbumListItem`:

```ts
export type MusicArtist = {
  id: string
  name: string
  bio?: string
  image_url?: string
  entry_status?: MusicEntryStatus
}

export type MusicArtistInput = {
  name: string
  bio?: string
}
```

Add these endpoint methods inside `musicV1Endpoints`:

```ts
artists: () => `${API_V1_BASE}/music/artists`,
artist: (artistId: string) => `${API_V1_BASE}/music/artists/${artistId}`,
```

If `artists` and `artist` already exist, keep one copy only.

Add these functions after `listMusicAlbums`:

```ts
export async function listMusicArtists(filters: MusicListFilters = {}): Promise<MusicListResponse<MusicArtist>> {
  const response = await apiGetEnvelope<MusicArtist[], PaginationMeta>(`${musicV1Endpoints.artists()}${queryString(filters)}`)
  return {
    data: response.data,
    meta: response.meta ?? {
      page: filters.page ?? 1,
      page_size: filters.page_size ?? response.data.length,
      total: response.data.length,
      has_more: false,
    },
  }
}

export async function getMusicArtist(artistId: string): Promise<MusicArtist> {
  return apiGetEnvelope<MusicArtist>(musicV1Endpoints.artist(artistId)).then((response) => response.data)
}

export async function createMusicArtist(input: MusicArtistInput): Promise<MusicArtist> {
  return apiPostJson<MusicArtist>(musicV1Endpoints.artists(), input)
}

export async function updateMusicArtist(artistId: string, input: MusicArtistInput): Promise<MusicArtist> {
  return apiPatchJson<MusicArtist>(musicV1Endpoints.artist(artistId), input)
}
```

If `apiPatchJson` does not exist in `src/api/client.ts`, add it in Task 2 before this test is expected to pass.

- [ ] **Step 4: Run artist API tests again**

Run:

```bash
bun run test:unit -- tests/unit/api/musicV1.spec.ts
```

Expected: failure only if `apiPatchJson` is missing.

- [ ] **Step 5: Commit if green or continue to Task 2 if `apiPatchJson` is missing**

If all tests pass:

```bash
git add src/api/musicV1.ts tests/unit/api/musicV1.spec.ts
git commit -m "Add music artist wiki API helpers"
```

If `apiPatchJson` is missing, do not commit yet. Continue to Task 2.

---

## Task 2: Add PATCH support to the API client

**Files:**
- Modify: `src/api/client.ts`
- Modify: `tests/unit/api/musicV1.spec.ts`

- [ ] **Step 1: Write failing PATCH client test**

Append this test inside `describe('api v1 client', () => { ... })` in `tests/unit/api/musicV1.spec.ts`:

```ts
it('sends PATCH JSON requests with credentials and Accept headers', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ data: { id: 'artist_uuid', name: 'Updated' } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))

  const { apiPatchJson } = await import('@/api/client')
  const result = await apiPatchJson<{ id: string; name: string }>('/api/v1/music/artists/artist_uuid', { name: 'Updated' })

  expect(fetch).toHaveBeenCalledWith('/api/v1/music/artists/artist_uuid', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ name: 'Updated' }),
  })
  expect(result.name).toBe('Updated')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun run test:unit -- tests/unit/api/musicV1.spec.ts
```

Expected: FAIL with missing export `apiPatchJson`.

- [ ] **Step 3: Implement `apiPatchJson`**

Open `src/api/client.ts`. Add this export next to `apiPostJson`:

```ts
export async function apiPatchJson<T>(url: string, data: unknown): Promise<T> {
  return apiRequest<T>(url, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  })
}
```

If the client uses a differently named internal helper, use that existing helper but keep the public function signature exactly as shown.

- [ ] **Step 4: Run tests to verify PATCH and artist helpers pass**

Run:

```bash
bun run test:unit -- tests/unit/api/musicV1.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/client.ts src/api/musicV1.ts tests/unit/api/musicV1.spec.ts
git commit -m "Add wiki-style music API mutations"
```

---

## Task 3: Add direct album and upload API helpers

**Files:**
- Modify: `src/api/musicV1.ts`
- Modify: `tests/unit/api/musicV1.spec.ts`

- [ ] **Step 1: Write failing album helper tests**

Append this block inside `describe('music v1 adapter', () => { ... })`:

```ts
it('creates albums through direct wiki endpoints with tracks', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({
      data: {
        id: 'album_uuid',
        title: '2049',
        artist_ids: ['artist_uuid'],
        release_date: '2026-06-15',
        description: 'Kanye album fixture',
        tracks: [{ id: 'song_uuid', title: 'Track One', position: 1, audio_url: '/uploads/track.mp3' }],
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))

  const { createMusicAlbum } = await import('@/api/musicV1')
  const result = await createMusicAlbum({
    title: '2049',
    artist_ids: ['artist_uuid'],
    release_date: '2026-06-15',
    description: 'Kanye album fixture',
    tracks: [{ title: 'Track One', position: 1, audio_url: '/uploads/track.mp3', audio_key: 'music/audio/track.mp3' }],
  })

  expect(fetch).toHaveBeenCalledWith('/api/v1/music/albums', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      title: '2049',
      artist_ids: ['artist_uuid'],
      release_date: '2026-06-15',
      description: 'Kanye album fixture',
      tracks: [{ title: 'Track One', position: 1, audio_url: '/uploads/track.mp3', audio_key: 'music/audio/track.mp3' }],
    }),
  })
  expect(result.tracks[0]?.title).toBe('Track One')
})

it('updates albums through direct wiki endpoints', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ data: { id: 'album_uuid', title: '2049 Updated', tracks: [] } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))

  const { updateMusicAlbum } = await import('@/api/musicV1')
  const result = await updateMusicAlbum('album_uuid', { title: '2049 Updated', tracks: [] })

  expect(fetch).toHaveBeenCalledWith('/api/v1/music/albums/album_uuid', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ title: '2049 Updated', tracks: [] }),
  })
  expect(result.title).toBe('2049 Updated')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun run test:unit -- tests/unit/api/musicV1.spec.ts
```

Expected: FAIL with missing exports `createMusicAlbum` and `updateMusicAlbum`.

- [ ] **Step 3: Implement album types and helpers**

Add these types to `src/api/musicV1.ts` after `MusicArtistInput`:

```ts
export type MusicTrackInput = {
  title: string
  position: number
  audio_url?: string
  audio_key?: string
  duration_seconds?: number
}

export type MusicTrack = MusicTrackInput & {
  id: string
}

export type MusicAlbum = {
  id: string
  title: string
  artist_ids?: string[]
  artists?: Array<{ id: string; name: string }>
  release_date?: string
  cover_url?: string
  cover_key?: string
  description?: string
  entry_status?: MusicEntryStatus
  tracks: MusicTrack[]
}

export type MusicAlbumInput = {
  title: string
  artist_ids: string[]
  release_date?: string
  cover_url?: string
  cover_key?: string
  description?: string
  tracks: MusicTrackInput[]
}
```

Add these functions after `updateMusicArtist`:

```ts
export async function getMusicAlbum(albumId: string): Promise<MusicAlbum> {
  return apiGetEnvelope<MusicAlbum>(musicV1Endpoints.album(albumId)).then((response) => response.data)
}

export async function createMusicAlbum(input: MusicAlbumInput): Promise<MusicAlbum> {
  return apiPostJson<MusicAlbum>(musicV1Endpoints.albums(), input)
}

export async function updateMusicAlbum(albumId: string, input: Partial<MusicAlbumInput>): Promise<MusicAlbum> {
  return apiPatchJson<MusicAlbum>(musicV1Endpoints.album(albumId), input)
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
bun run test:unit -- tests/unit/api/musicV1.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/musicV1.ts tests/unit/api/musicV1.spec.ts
git commit -m "Add music album wiki API helpers"
```

---

## Task 4: Make music home data-backed and non-blank

**Files:**
- Modify: `src/views/music/HomeView.vue`
- Modify: `tests/unit/views/music/MusicHomeView.spec.ts`

- [ ] **Step 1: Write failing home state tests**

Replace `tests/unit/views/music/MusicHomeView.spec.ts` with:

```ts
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import HomeView from '@/views/music/HomeView.vue'

vi.mock('@/components/music/ArtistDrawer.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/music/AlbumDrawer.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/music/NestedActionDrawer.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    isMainShifted: { value: false },
    openArtist: vi.fn(),
    openNestedAction: vi.fn(),
  }),
}))

describe('Music HomeView.vue', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders an empty state and create artist entry when no artists exist', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    const wrapper = mount(HomeView, {
      global: { plugins: [createTestingPinia({ createSpy: vi.fn })], stubs: ['RouterLink'] },
    })
    await flushPromises()

    expect(wrapper.get('h1').text()).toContain('艺术家')
    expect(wrapper.text()).toContain('还没有艺术家')
    expect(wrapper.text()).toContain('新建艺术家')
  })

  it('renders artists returned from the wiki list endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 'artist_uuid', name: 'Kanye West', bio: 'Bio', entry_status: 'open' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    const wrapper = mount(HomeView, {
      global: { plugins: [createTestingPinia({ createSpy: vi.fn })], stubs: ['RouterLink'] },
    })
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/artists', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    expect(wrapper.text()).toContain('Kanye West')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun run test:unit -- tests/unit/views/music/MusicHomeView.spec.ts
```

Expected: FAIL because current page calls legacy `/artists`, has no empty state, and does not unwrap `{ data }`.

- [ ] **Step 3: Implement minimal home states**

Update `src/views/music/HomeView.vue` script to use `listMusicArtists` and state refs:

```ts
import { computed, ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { listMusicArtists, type MusicArtist } from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import ArtistDrawer from '@/components/music/ArtistDrawer.vue'
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'
import NestedActionDrawer from '@/components/music/NestedActionDrawer.vue'

const { isMainShifted, openArtist } = useMusicDrawers()

const artists = ref<MusicArtist[]>([])
const searchQuery = ref('')
const loading = ref(true)
const error = ref('')

const filteredArtists = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return artists.value
  return artists.value.filter((artist) => artist.name.toLowerCase().includes(query))
})

async function fetchArtists() {
  loading.value = true
  error.value = ''
  try {
    const result = await listMusicArtists()
    artists.value = result.data
  } catch (e) {
    error.value = e instanceof Error ? e.message : '无法加载艺术家'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void fetchArtists()
})
```

Update template states:

```vue
<div class="search-bar">
  <input v-model="searchQuery" placeholder="搜索艺术家..." class="search-input" />
  <RouterLink class="a-btn" to="/artist/new">新建艺术家</RouterLink>
</div>

<p v-if="loading" class="a-muted">正在加载艺术家...</p>
<p v-else-if="error" class="a-error">{{ error }}</p>
<div v-else-if="filteredArtists.length === 0" class="empty-state">
  <p class="a-font-meta">EMPTY ARCHIVE</p>
  <h2>还没有艺术家</h2>
  <p>创建第一条音乐档案后，它会出现在这里。</p>
  <RouterLink class="a-btn" to="/artist/new">新建艺术家</RouterLink>
</div>
<div v-else class="grid">
  <button v-for="artist in filteredArtists" :key="artist.id" class="card" type="button" @click="openArtist(String(artist.id))">
    <div class="card-img">
      <img v-if="artist.image_url" :src="artist.image_url" class="artist-avatar" :alt="artist.name" />
      <span v-else>ARTIST</span>
    </div>
    <div class="card-body">
      <div class="card-title">{{ artist.name }}</div>
      <div class="card-sub">{{ artist.entry_status === 'confirmed' ? '已确认' : '开放编辑' }}</div>
    </div>
  </button>
</div>
```

Add CSS for link/button reset and empty state:

```css
.empty-state {
  max-width: 36rem;
  padding: 2rem;
  border: 2px solid var(--a-color-ink);
  background: var(--a-color-paper);
  box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.08);
}
.empty-state h2 { margin: 0.5rem 0; font-size: 1.75rem; font-weight: 900; }
.empty-state p { color: var(--a-color-muted); }
.card { text-align: left; }
.a-btn { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; color: inherit; }
```

- [ ] **Step 4: Run test to verify pass**

Run:

```bash
bun run test:unit -- tests/unit/views/music/MusicHomeView.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/music/HomeView.vue tests/unit/views/music/MusicHomeView.spec.ts
git commit -m "Render music home from wiki artist API"
```

---

## Task 5: Add shared artist form and wire create/edit artist

**Files:**
- Create: `src/components/music/MusicArtistForm.vue`
- Modify: `src/views/music/CreateArtistView.vue`
- Create: `src/views/music/EditArtistView.vue`
- Create: `src/views/music/ArtistDetailView.vue`
- Create: `tests/unit/views/music/MusicArtistForm.spec.ts`
- Create: `tests/unit/views/music/ArtistDetailView.spec.ts`
- Modify: `src/router/routes/modules.ts`

- [ ] **Step 1: Write failing artist form test**

Create `tests/unit/views/music/MusicArtistForm.spec.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MusicArtistForm from '@/components/music/MusicArtistForm.vue'

describe('MusicArtistForm', () => {
  it('shows field errors when artist name is empty', async () => {
    const wrapper = mount(MusicArtistForm, { props: { submitLabel: '保存艺术家' } })

    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('请输入艺术家名称')
  })

  it('emits trimmed artist input when valid', async () => {
    const wrapper = mount(MusicArtistForm, { props: { submitLabel: '保存艺术家' } })

    await wrapper.get('input[aria-label="艺术家名称"]').setValue('  Kanye West  ')
    await wrapper.get('textarea[aria-label="艺术家简介"]').setValue('  Bio  ')
    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.emitted('submit')?.[0]).toEqual([{ name: 'Kanye West', bio: 'Bio' }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun run test:unit -- tests/unit/views/music/MusicArtistForm.spec.ts
```

Expected: FAIL because `MusicArtistForm.vue` does not exist.

- [ ] **Step 3: Create `MusicArtistForm.vue`**

Create `src/components/music/MusicArtistForm.vue`:

```vue
<script setup lang="ts">
import { reactive, watch } from 'vue'
import AInput from '@/components/ui/AInput.vue'
import ATextarea from '@/components/ui/ATextarea.vue'
import ABtn from '@/components/ui/ABtn.vue'
import type { MusicArtistInput } from '@/api/musicV1'

const props = withDefaults(defineProps<{
  initialValue?: Partial<MusicArtistInput>
  submitLabel: string
  submitting?: boolean
  serverError?: string
}>(), {
  initialValue: () => ({}),
  submitting: false,
  serverError: '',
})

const emit = defineEmits<{
  submit: [value: MusicArtistInput]
}>()

const form = reactive({ name: props.initialValue.name ?? '', bio: props.initialValue.bio ?? '' })
const errors = reactive<{ name?: string }>({})

watch(() => props.initialValue, (value) => {
  form.name = value?.name ?? ''
  form.bio = value?.bio ?? ''
}, { deep: true })

function onSubmit() {
  errors.name = undefined
  const name = form.name.trim()
  const bio = form.bio.trim()
  if (!name) {
    errors.name = '请输入艺术家名称'
    return
  }
  emit('submit', { name, bio })
}
</script>

<template>
  <form class="music-artist-form" @submit.prevent="onSubmit">
    <AInput v-model="form.name" aria-label="艺术家名称" label="艺术家名称" placeholder="例如：Kanye West" :error="errors.name" required />
    <ATextarea v-model="form.bio" aria-label="艺术家简介" label="艺术家简介" placeholder="输入艺术家的背景、风格和主要作品。" :rows="6" />
    <p v-if="serverError" class="a-error" role="alert">{{ serverError }}</p>
    <ABtn type="submit" :disabled="submitting">{{ submitting ? '保存中...' : submitLabel }}</ABtn>
  </form>
</template>

<style scoped>
.music-artist-form { display: flex; flex-direction: column; gap: 1.5rem; }
</style>
```

- [ ] **Step 4: Run artist form test to verify pass**

Run:

```bash
bun run test:unit -- tests/unit/views/music/MusicArtistForm.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing create artist integration test**

Append to `tests/unit/views/music/MusicArtistForm.spec.ts`:

```ts
import { flushPromises } from '@vue/test-utils'
import { vi } from 'vitest'
import CreateArtistView from '@/views/music/CreateArtistView.vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ query: { name: 'Kanye West' } }),
}))

describe('CreateArtistView', () => {
  it('submits direct wiki artist creation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { id: 'artist_uuid', name: 'Kanye West', bio: 'Bio' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const wrapper = mount(CreateArtistView, { global: { stubs: ['APageHeader', 'ASurface'] } })
    await wrapper.get('textarea[aria-label="艺术家简介"]').setValue('Bio')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/artists', expect.objectContaining({ method: 'POST' }))
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run:

```bash
bun run test:unit -- tests/unit/views/music/MusicArtistForm.spec.ts
```

Expected: FAIL if `CreateArtistView` still posts to legacy endpoint or does not use the shared form.

- [ ] **Step 7: Update `CreateArtistView.vue`**

Replace the form internals with `MusicArtistForm` and use `createMusicArtist`:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import APageHeader from '@/components/ui/APageHeader.vue'
import ASurface from '@/components/ui/ASurface.vue'
import MusicArtistForm from '@/components/music/MusicArtistForm.vue'
import { createMusicArtist, type MusicArtistInput } from '@/api/musicV1'

const router = useRouter()
const route = useRoute()
const submitting = ref(false)
const serverError = ref('')

const initialValue = computed(() => ({ name: String(route.query.name ?? ''), bio: '' }))

async function handleSubmit(input: MusicArtistInput) {
  submitting.value = true
  serverError.value = ''
  try {
    const artist = await createMusicArtist(input)
    await router.push(`/artist/${artist.id}`)
  } catch (error) {
    serverError.value = error instanceof Error ? error.message : '创建艺术家失败'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="a-page">
    <APageHeader title="新建艺术家" sub="向音乐档案库添加新的艺术家资料。" accent />
    <ASurface class="form-surface" tone="soft" :layer="1">
      <MusicArtistForm :initial-value="initialValue" submit-label="创建艺术家" :submitting="submitting" :server-error="serverError" @submit="handleSubmit" />
    </ASurface>
  </div>
</template>
```

Keep existing scoped CSS if it still applies.

- [ ] **Step 8: Add routes for artist detail/edit**

Modify `src/router/routes/modules.ts` inside `music.children`:

```ts
{ path: 'artist/new', component: () => import('@/views/music/CreateArtistView.vue'), meta: { requiresAuth: true } },
{ path: 'artist/:id', component: () => import('@/views/music/ArtistDetailView.vue') },
{ path: 'artist/:id/edit', component: () => import('@/views/music/EditArtistView.vue'), meta: { requiresAuth: true } },
```

- [ ] **Step 9: Create artist detail and edit placeholder-real pages**

Create `src/views/music/ArtistDetailView.vue` with data-backed fetch:

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import APageHeader from '@/components/ui/APageHeader.vue'
import ASurface from '@/components/ui/ASurface.vue'
import ABtn from '@/components/ui/ABtn.vue'
import { getMusicArtist, listMusicAlbums, type MusicArtist, type MusicAlbumListItem } from '@/api/musicV1'

const route = useRoute()
const artistId = computed(() => String(route.params.id))
const artist = ref<MusicArtist | null>(null)
const albums = ref<MusicAlbumListItem[]>([])
const loading = ref(true)
const error = ref('')

async function loadArtist() {
  loading.value = true
  error.value = ''
  try {
    artist.value = await getMusicArtist(artistId.value)
    albums.value = (await listMusicAlbums({ artist_id: artistId.value })).data
  } catch (e) {
    error.value = e instanceof Error ? e.message : '无法加载艺术家'
  } finally {
    loading.value = false
  }
}

onMounted(() => { void loadArtist() })
</script>

<template>
  <div class="a-page">
    <p v-if="loading" class="a-muted">正在加载艺术家...</p>
    <p v-else-if="error" class="a-error" role="alert">{{ error }}</p>
    <template v-else-if="artist">
      <APageHeader :title="artist.name" :sub="artist.bio || '开放编辑的音乐档案。'" accent />
      <div class="artist-actions">
        <RouterLink :to="`/artist/${artist.id}/edit`"><ABtn>编辑艺术家</ABtn></RouterLink>
        <RouterLink :to="`/artist/${artist.id}/album/new`"><ABtn>添加新专辑</ABtn></RouterLink>
      </div>
      <ASurface class="album-list" tone="soft" :layer="1">
        <h2>专辑列表</h2>
        <p v-if="albums.length === 0" class="a-muted">还没有专辑。</p>
        <RouterLink v-for="album in albums" :key="album.id" class="album-row" :to="`/album/${album.id}`">
          <span>{{ album.release_date || '未知日期' }}</span>
          <strong>{{ album.title }}</strong>
        </RouterLink>
      </ASurface>
    </template>
  </div>
</template>
```

Create `src/views/music/EditArtistView.vue`:

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import APageHeader from '@/components/ui/APageHeader.vue'
import ASurface from '@/components/ui/ASurface.vue'
import MusicArtistForm from '@/components/music/MusicArtistForm.vue'
import { getMusicArtist, updateMusicArtist, type MusicArtistInput } from '@/api/musicV1'

const route = useRoute()
const router = useRouter()
const artistId = computed(() => String(route.params.id))
const initialValue = ref<Partial<MusicArtistInput>>({})
const loading = ref(true)
const submitting = ref(false)
const serverError = ref('')

onMounted(async () => {
  const artist = await getMusicArtist(artistId.value)
  initialValue.value = { name: artist.name, bio: artist.bio ?? '' }
  loading.value = false
})

async function handleSubmit(input: MusicArtistInput) {
  submitting.value = true
  serverError.value = ''
  try {
    await updateMusicArtist(artistId.value, input)
    await router.push(`/artist/${artistId.value}`)
  } catch (error) {
    serverError.value = error instanceof Error ? error.message : '保存艺术家失败'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="a-page">
    <APageHeader title="编辑艺术家" sub="wiki 模式：保存后立即更新。" accent />
    <ASurface class="form-surface" tone="soft" :layer="1">
      <p v-if="loading" class="a-muted">正在加载艺术家...</p>
      <MusicArtistForm v-else :initial-value="initialValue" submit-label="保存艺术家" :submitting="submitting" :server-error="serverError" @submit="handleSubmit" />
    </ASurface>
  </div>
</template>
```

- [ ] **Step 10: Run artist tests**

Run:

```bash
bun run test:unit -- tests/unit/views/music/MusicArtistForm.spec.ts tests/unit/views/music/ArtistDetailView.spec.ts
```

Expected: PASS after adding or adjusting `ArtistDetailView.spec.ts` to mock `getMusicArtist` and `listMusicAlbums`.

- [ ] **Step 11: Commit**

```bash
git add src/components/music/MusicArtistForm.vue src/views/music/CreateArtistView.vue src/views/music/ArtistDetailView.vue src/views/music/EditArtistView.vue src/router/routes/modules.ts tests/unit/views/music/MusicArtistForm.spec.ts tests/unit/views/music/ArtistDetailView.spec.ts
git commit -m "Add wiki artist create and edit flow"
```

---

## Task 6: Add shared album form and wire create/edit album

**Files:**
- Create: `src/components/music/MusicAlbumForm.vue`
- Create: `src/views/music/CreateAlbumView.vue`
- Create: `src/views/music/EditAlbumView.vue`
- Create: `src/views/music/AlbumDetailView.vue`
- Create: `tests/unit/views/music/MusicAlbumForm.spec.ts`
- Create: `tests/unit/views/music/AlbumDetailView.spec.ts`
- Modify: `src/router/routes/modules.ts`

- [ ] **Step 1: Write failing album form tests**

Create `tests/unit/views/music/MusicAlbumForm.spec.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MusicAlbumForm from '@/components/music/MusicAlbumForm.vue'

describe('MusicAlbumForm', () => {
  it('requires album title and at least one track title', async () => {
    const wrapper = mount(MusicAlbumForm, { props: { artistId: 'artist_uuid', submitLabel: '创建专辑' } })

    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('请输入专辑标题')
    expect(wrapper.text()).toContain('请输入曲目标题')
  })

  it('emits album input with track data', async () => {
    const wrapper = mount(MusicAlbumForm, { props: { artistId: 'artist_uuid', submitLabel: '创建专辑' } })

    await wrapper.get('input[aria-label="专辑标题"]').setValue('2049')
    await wrapper.get('input[aria-label="曲目 1 标题"]').setValue('Track One')
    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.emitted('submit')?.[0]).toEqual([{
      title: '2049',
      artist_ids: ['artist_uuid'],
      release_date: '',
      description: '',
      tracks: [{ title: 'Track One', position: 1 }],
    }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun run test:unit -- tests/unit/views/music/MusicAlbumForm.spec.ts
```

Expected: FAIL because `MusicAlbumForm.vue` does not exist.

- [ ] **Step 3: Create minimal album form**

Create `src/components/music/MusicAlbumForm.vue`:

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import AInput from '@/components/ui/AInput.vue'
import ATextarea from '@/components/ui/ATextarea.vue'
import ABtn from '@/components/ui/ABtn.vue'
import type { MusicAlbumInput, MusicTrackInput } from '@/api/musicV1'

const props = withDefaults(defineProps<{
  artistId: string
  initialValue?: Partial<MusicAlbumInput>
  submitLabel: string
  submitting?: boolean
  serverError?: string
}>(), {
  initialValue: () => ({}),
  submitting: false,
  serverError: '',
})

const emit = defineEmits<{
  submit: [value: MusicAlbumInput]
}>()

const form = reactive({
  title: props.initialValue.title ?? '',
  release_date: props.initialValue.release_date ?? '',
  description: props.initialValue.description ?? '',
  tracks: props.initialValue.tracks?.length ? props.initialValue.tracks.map((track) => ({ ...track })) : [{ title: '', position: 1 }] as MusicTrackInput[],
})

const errors = reactive<{ title?: string; tracks?: string }>({})

function addTrack() {
  form.tracks.push({ title: '', position: form.tracks.length + 1 })
}

function onSubmit() {
  errors.title = undefined
  errors.tracks = undefined
  const title = form.title.trim()
  const tracks = form.tracks
    .map((track, index) => ({ ...track, title: track.title.trim(), position: index + 1 }))
    .filter((track) => track.title)
  if (!title) errors.title = '请输入专辑标题'
  if (tracks.length === 0) errors.tracks = '请输入曲目标题'
  if (errors.title || errors.tracks) return
  emit('submit', {
    title,
    artist_ids: [props.artistId],
    release_date: form.release_date,
    description: form.description.trim(),
    tracks,
  })
}
</script>

<template>
  <form class="music-album-form" @submit.prevent="onSubmit">
    <AInput v-model="form.title" aria-label="专辑标题" label="专辑标题" placeholder="例如：2049" :error="errors.title" required />
    <AInput v-model="form.release_date" aria-label="发行日期" label="发行日期" placeholder="2026-06-15" />
    <ATextarea v-model="form.description" aria-label="专辑简介" label="专辑简介" :rows="4" />
    <section class="track-section">
      <h2>曲目</h2>
      <p v-if="errors.tracks" class="a-error">{{ errors.tracks }}</p>
      <div v-for="(track, index) in form.tracks" :key="index" class="track-row">
        <AInput v-model="track.title" :aria-label="`曲目 ${index + 1} 标题`" :label="`曲目 ${index + 1}`" placeholder="曲目标题" />
      </div>
      <button type="button" class="link-button" @click="addTrack">添加曲目</button>
    </section>
    <p v-if="serverError" class="a-error" role="alert">{{ serverError }}</p>
    <ABtn type="submit" :disabled="submitting">{{ submitting ? '保存中...' : submitLabel }}</ABtn>
  </form>
</template>

<style scoped>
.music-album-form { display: flex; flex-direction: column; gap: 1.5rem; }
.track-section { border-top: 2px solid var(--a-color-ink); padding-top: 1rem; }
.track-section h2 { margin: 0 0 1rem; font-size: 1.25rem; font-weight: 900; }
.track-row { margin-bottom: 1rem; }
.link-button { border: 0; background: transparent; border-bottom: 2px solid var(--a-color-ink); font-weight: 900; cursor: pointer; }
</style>
```

- [ ] **Step 4: Run album form tests**

Run:

```bash
bun run test:unit -- tests/unit/views/music/MusicAlbumForm.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Add album routes**

Modify `src/router/routes/modules.ts` inside `music.children`:

```ts
{ path: 'artist/:artistId/album/new', component: () => import('@/views/music/CreateAlbumView.vue'), meta: { requiresAuth: true } },
{ path: 'album/:id', component: () => import('@/views/music/AlbumDetailView.vue') },
{ path: 'album/:id/edit', component: () => import('@/views/music/EditAlbumView.vue'), meta: { requiresAuth: true } },
```

- [ ] **Step 6: Create album create/detail/edit pages**

Create `src/views/music/CreateAlbumView.vue`:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import APageHeader from '@/components/ui/APageHeader.vue'
import ASurface from '@/components/ui/ASurface.vue'
import MusicAlbumForm from '@/components/music/MusicAlbumForm.vue'
import { createMusicAlbum, type MusicAlbumInput } from '@/api/musicV1'

const route = useRoute()
const router = useRouter()
const artistId = computed(() => String(route.params.artistId))
const submitting = ref(false)
const serverError = ref('')

async function handleSubmit(input: MusicAlbumInput) {
  submitting.value = true
  serverError.value = ''
  try {
    const album = await createMusicAlbum(input)
    await router.push(`/album/${album.id}`)
  } catch (error) {
    serverError.value = error instanceof Error ? error.message : '创建专辑失败'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="a-page">
    <APageHeader title="新建专辑" sub="wiki 模式：保存后立即加入音乐档案。" accent />
    <ASurface class="form-surface" tone="soft" :layer="1">
      <MusicAlbumForm :artist-id="artistId" submit-label="创建专辑" :submitting="submitting" :server-error="serverError" @submit="handleSubmit" />
    </ASurface>
  </div>
</template>
```

Create `src/views/music/AlbumDetailView.vue`:

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import APageHeader from '@/components/ui/APageHeader.vue'
import ABtn from '@/components/ui/ABtn.vue'
import ASurface from '@/components/ui/ASurface.vue'
import { usePlayerStore } from '@/stores/player'
import { getMusicAlbum, type MusicAlbum } from '@/api/musicV1'

const route = useRoute()
const player = usePlayerStore()
const albumId = computed(() => String(route.params.id))
const album = ref<MusicAlbum | null>(null)
const loading = ref(true)
const error = ref('')

async function loadAlbum() {
  loading.value = true
  error.value = ''
  try {
    album.value = await getMusicAlbum(albumId.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '无法加载专辑'
  } finally {
    loading.value = false
  }
}

function playTrack(index: number) {
  if (!album.value) return
  const songs = album.value.tracks.map((track) => ({
    id: Number.parseInt(track.id, 10) || index + 1,
    title: track.title,
    artist: album.value?.artists?.map((artist) => artist.name).join(', ') || '未知艺术家',
    album: album.value?.title || '',
    album_id: album.value?.id || '',
    year: album.value?.release_date ? Number(album.value.release_date.slice(0, 4)) : 0,
    release_date: album.value?.release_date || '',
    lyrics: '',
    audio_url: track.audio_url || '',
    cover_url: album.value?.cover_url || '',
    status: 'approved' as const,
  }))
  player.playAlbum(songs, index)
}

onMounted(() => { void loadAlbum() })
</script>

<template>
  <div class="a-page">
    <p v-if="loading" class="a-muted">正在加载专辑...</p>
    <p v-else-if="error" class="a-error" role="alert">{{ error }}</p>
    <template v-else-if="album">
      <APageHeader :title="album.title" :sub="album.description || '开放编辑的专辑档案。'" accent />
      <div class="album-actions">
        <ABtn type="button" @click="playTrack(0)">播放全专</ABtn>
        <RouterLink :to="`/album/${album.id}/edit`"><ABtn>编辑专辑</ABtn></RouterLink>
      </div>
      <ASurface class="track-list" tone="soft" :layer="1">
        <h2>Tracklist</h2>
        <button v-for="(track, index) in album.tracks" :key="track.id" class="track-row" type="button" @click="playTrack(index)">
          <span>{{ index + 1 }}</span>
          <strong>{{ track.title }}</strong>
          <span>播放</span>
        </button>
      </ASurface>
    </template>
  </div>
</template>
```

Create `src/views/music/EditAlbumView.vue`:

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import APageHeader from '@/components/ui/APageHeader.vue'
import ASurface from '@/components/ui/ASurface.vue'
import MusicAlbumForm from '@/components/music/MusicAlbumForm.vue'
import { getMusicAlbum, updateMusicAlbum, type MusicAlbumInput } from '@/api/musicV1'

const route = useRoute()
const router = useRouter()
const albumId = computed(() => String(route.params.id))
const artistId = ref('')
const initialValue = ref<Partial<MusicAlbumInput>>({})
const loading = ref(true)
const submitting = ref(false)
const serverError = ref('')

onMounted(async () => {
  const album = await getMusicAlbum(albumId.value)
  artistId.value = album.artist_ids?.[0] || album.artists?.[0]?.id || ''
  initialValue.value = {
    title: album.title,
    artist_ids: artistId.value ? [artistId.value] : [],
    release_date: album.release_date ?? '',
    description: album.description ?? '',
    tracks: album.tracks,
  }
  loading.value = false
})

async function handleSubmit(input: MusicAlbumInput) {
  submitting.value = true
  serverError.value = ''
  try {
    await updateMusicAlbum(albumId.value, input)
    await router.push(`/album/${albumId.value}`)
  } catch (error) {
    serverError.value = error instanceof Error ? error.message : '保存专辑失败'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="a-page">
    <APageHeader title="编辑专辑" sub="wiki 模式：保存后立即更新。" accent />
    <ASurface class="form-surface" tone="soft" :layer="1">
      <p v-if="loading" class="a-muted">正在加载专辑...</p>
      <MusicAlbumForm v-else :artist-id="artistId" :initial-value="initialValue" submit-label="保存专辑" :submitting="submitting" :server-error="serverError" @submit="handleSubmit" />
    </ASurface>
  </div>
</template>
```

- [ ] **Step 7: Run album tests**

Run:

```bash
bun run test:unit -- tests/unit/views/music/MusicAlbumForm.spec.ts tests/unit/views/music/AlbumDetailView.spec.ts
```

Expected: PASS after adding `AlbumDetailView.spec.ts` with mocked `getMusicAlbum` and `player.playAlbum`.

- [ ] **Step 8: Commit**

```bash
git add src/components/music/MusicAlbumForm.vue src/views/music/CreateAlbumView.vue src/views/music/AlbumDetailView.vue src/views/music/EditAlbumView.vue src/router/routes/modules.ts tests/unit/views/music/MusicAlbumForm.spec.ts tests/unit/views/music/AlbumDetailView.spec.ts
git commit -m "Add wiki album create edit and playback views"
```

---

## Task 7: Add real file upload controls to album form

**Files:**
- Modify: `src/components/music/MusicAlbumForm.vue`
- Modify: `tests/unit/views/music/MusicAlbumForm.spec.ts`

- [ ] **Step 1: Write failing upload test**

Append to `tests/unit/views/music/MusicAlbumForm.spec.ts`:

```ts
it('uploads audio and includes returned URL in emitted track payload', async () => {
  const wrapper = mount(MusicAlbumForm, { props: { artistId: 'artist_uuid', submitLabel: '创建专辑' } })
  const file = new File(['audio'], 'track.mp3', { type: 'audio/mpeg' })

  await wrapper.get('input[aria-label="专辑标题"]').setValue('2049')
  await wrapper.get('input[aria-label="曲目 1 标题"]').setValue('Track One')
  await wrapper.get('input[aria-label="曲目 1 音频文件"]').trigger('change', { target: { files: [file] } })
  await wrapper.get('form').trigger('submit.prevent')

  expect(wrapper.emitted('upload')?.[0]).toEqual([{ file, trackIndex: 0 }])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun run test:unit -- tests/unit/views/music/MusicAlbumForm.spec.ts
```

Expected: FAIL because there is no audio file input or upload event.

- [ ] **Step 3: Add upload event to album form**

Update the emits type in `MusicAlbumForm.vue`:

```ts
const emit = defineEmits<{
  submit: [value: MusicAlbumInput]
  upload: [value: { file: File; trackIndex: number }]
}>()
```

Add handler:

```ts
function onAudioFileChange(event: Event, trackIndex: number) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  emit('upload', { file, trackIndex })
}
```

Add input inside each `.track-row`:

```vue
<input :aria-label="`曲目 ${index + 1} 音频文件`" type="file" accept="audio/*" @change="onAudioFileChange($event, index)" />
```

- [ ] **Step 4: Run unit test**

Run:

```bash
bun run test:unit -- tests/unit/views/music/MusicAlbumForm.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Wire upload in create/edit pages**

In `CreateAlbumView.vue` and `EditAlbumView.vue`, import `uploadMusicAsset` and maintain uploaded track assets:

```ts
import { createMusicAlbum, uploadMusicAsset, type MusicAlbumInput } from '@/api/musicV1'

async function handleAudioUpload({ file, trackIndex }: { file: File; trackIndex: number }) {
  const asset = await uploadMusicAsset(file, 'music.audio')
  uploadedTracks.value[trackIndex] = asset
}
```

Before submit, merge uploaded URLs into tracks:

```ts
const payload = {
  ...input,
  tracks: input.tracks.map((track, index) => ({
    ...track,
    ...(uploadedTracks.value[index] ? { audio_url: uploadedTracks.value[index].url, audio_key: uploadedTracks.value[index].key } : {}),
  })),
}
```

Pass handler into form:

```vue
<MusicAlbumForm ... @upload="handleAudioUpload" @submit="handleSubmit" />
```

- [ ] **Step 6: Run album tests and API tests**

Run:

```bash
bun run test:unit -- tests/unit/views/music/MusicAlbumForm.spec.ts tests/unit/api/musicV1.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/music/MusicAlbumForm.vue src/views/music/CreateAlbumView.vue src/views/music/EditAlbumView.vue tests/unit/views/music/MusicAlbumForm.spec.ts
git commit -m "Add music album audio upload flow"
```

---

## Task 8: Replace placeholder drawer actions in main wiki path

**Files:**
- Modify: `src/components/music/ArtistDrawer.vue`
- Modify: `src/components/music/AlbumDrawer.vue`
- Modify: `src/components/music/NestedActionDrawer.vue`
- Modify: `tests/unit/components/music/ArtistDrawer.spec.ts`
- Modify: `tests/unit/components/music/AlbumDrawer.spec.ts`
- Modify: `tests/unit/components/music/NestedActionDrawer.spec.ts`

- [ ] **Step 1: Write failing tests that reject placeholder text**

Update `tests/unit/components/music/ArtistDrawer.spec.ts` assertion block:

```ts
expect(wrapper.text()).not.toContain('The Dark Side of the Moon')
expect(wrapper.text()).not.toContain('Wish You Were Here')
expect(wrapper.text()).toContain('查看艺术家详情')
```

Update `tests/unit/components/music/AlbumDrawer.spec.ts`:

```ts
expect(wrapper.text()).not.toContain('Track 1')
expect(wrapper.text()).toContain('查看专辑详情')
```

Update `tests/unit/components/music/NestedActionDrawer.spec.ts`:

```ts
expect(wrapper.text()).not.toContain('标题')
expect(wrapper.text()).not.toContain('提交')
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
bun run test:unit -- tests/unit/components/music/ArtistDrawer.spec.ts tests/unit/components/music/AlbumDrawer.spec.ts tests/unit/components/music/NestedActionDrawer.spec.ts
```

Expected: FAIL because placeholder content still renders.

- [ ] **Step 3: Convert drawers into navigation shells**

In `ArtistDrawer.vue`, remove `dummyAlbums` and render links:

```vue
<RouterLink class="a-btn-dashed" :to="`/artist/${state.artistId}`">查看艺术家详情</RouterLink>
<RouterLink class="a-btn-dashed" :to="`/artist/${state.artistId}/edit`">编辑艺术家</RouterLink>
<RouterLink class="a-btn-dashed" :to="`/artist/${state.artistId}/album/new`">添加新专辑</RouterLink>
```

In `AlbumDrawer.vue`, replace placeholder album body with:

```vue
<RouterLink class="a-btn-primary" :to="`/album/${state.albumId}`">查看专辑详情</RouterLink>
<RouterLink class="a-btn-dashed" :to="`/album/${state.albumId}/edit`">编辑专辑</RouterLink>
```

In `NestedActionDrawer.vue`, remove the placeholder form branch for `revise` and `add_album`. Keep history/discussion if needed, or render:

```vue
<p class="a-muted">此操作已移到 wiki 页面中完成。</p>
```

- [ ] **Step 4: Run drawer tests**

Run:

```bash
bun run test:unit -- tests/unit/components/music/ArtistDrawer.spec.ts tests/unit/components/music/AlbumDrawer.spec.ts tests/unit/components/music/NestedActionDrawer.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/music/ArtistDrawer.vue src/components/music/AlbumDrawer.vue src/components/music/NestedActionDrawer.vue tests/unit/components/music/ArtistDrawer.spec.ts tests/unit/components/music/AlbumDrawer.spec.ts tests/unit/components/music/NestedActionDrawer.spec.ts
git commit -m "Remove music placeholder drawers from wiki path"
```

---

## Task 9: Add deterministic mock Playwright flow

**Files:**
- Create: `tests/e2e/specs/music-wiki.mock.spec.ts`
- Modify: `tests/e2e/fixtures/base.ts` only if route patching blocks root-scoped music paths.

- [ ] **Step 1: Write failing mock e2e**

Create `tests/e2e/specs/music-wiki.mock.spec.ts`:

```ts
import { test, expect } from '../fixtures/base'

test.describe('Music wiki flow with mocked API', () => {
  test('registers, creates artist and album, plays, and edits data', async ({ page }) => {
    const state = {
      token: 'mock-token',
      user: { id: 501, uuid: 'user_uuid', username: 'e2e-music', email: 'e2e-music@atoman.test', role: 'user' },
      artist: { id: 'artist_uuid', name: 'Kanye West', bio: 'Original artist bio', entry_status: 'open' },
      album: {
        id: 'album_uuid',
        title: '2049',
        artist_ids: ['artist_uuid'],
        artists: [{ id: 'artist_uuid', name: 'Kanye West' }],
        release_date: '2026-06-15',
        description: 'Original album description',
        tracks: [{ id: 'song_uuid', title: 'Track One', position: 1, audio_url: '/mock/track.mp3' }],
      },
    }

    await page.route('**/api/v1/auth/register', async (route) => {
      await route.fulfill({ json: { token: state.token, user: state.user } })
    })
    await page.route('**/api/v1/music/artists', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON()
        state.artist = { ...state.artist, name: body.name, bio: body.bio }
        await route.fulfill({ json: { data: state.artist } })
        return
      }
      await route.fulfill({ json: { data: [state.artist], meta: { page: 1, page_size: 1, total: 1, has_more: false } } })
    })
    await page.route('**/api/v1/music/artists/artist_uuid', async (route) => {
      if (route.request().method() === 'PATCH') {
        state.artist = { ...state.artist, ...route.request().postDataJSON() }
      }
      await route.fulfill({ json: { data: state.artist } })
    })
    await page.route('**/api/v1/music/albums?artist_id=artist_uuid', async (route) => {
      await route.fulfill({ json: { data: [state.album], meta: { page: 1, page_size: 1, total: 1, has_more: false } } })
    })
    await page.route('**/api/v1/music/albums', async (route) => {
      if (route.request().method() === 'POST') {
        state.album = { ...state.album, ...route.request().postDataJSON(), id: 'album_uuid', artists: [{ id: 'artist_uuid', name: state.artist.name }] }
        await route.fulfill({ json: { data: state.album } })
        return
      }
      await route.fulfill({ json: { data: [state.album], meta: { page: 1, page_size: 1, total: 1, has_more: false } } })
    })
    await page.route('**/api/v1/music/albums/album_uuid', async (route) => {
      if (route.request().method() === 'PATCH') {
        state.album = { ...state.album, ...route.request().postDataJSON() }
      }
      await route.fulfill({ json: { data: state.album } })
    })
    await page.route('**/api/v1/uploads', async (route) => {
      await route.fulfill({ json: { data: { url: '/mock/track.mp3', key: 'music/audio/track.mp3', content_type: 'audio/mpeg', size: 5 } } })
    })

    await page.goto('/register')
    await page.getByPlaceholder('输入邮箱').fill('e2e-music@atoman.test')
    await page.getByPlaceholder('输入用户名').fill('e2e-music')
    await page.getByPlaceholder('输入密码').fill('password123')
    await page.getByPlaceholder('再次输入密码').fill('password123')
    await page.getByRole('button', { name: /注 册|加入我们|注册/ }).click()

    await page.goto('/artist/new')
    await page.getByLabel('艺术家名称').fill('Kanye West')
    await page.getByLabel('艺术家简介').fill('Original artist bio')
    await page.getByRole('button', { name: '创建艺术家' }).click()
    await expect(page.getByRole('heading', { name: 'Kanye West' })).toBeVisible()

    await page.getByRole('link', { name: /添加新专辑/ }).click()
    await page.getByLabel('专辑标题').fill('2049')
    await page.getByLabel('发行日期').fill('2026-06-15')
    await page.getByLabel('专辑简介').fill('Original album description')
    await page.getByLabel('曲目 1 标题').fill('Track One')
    await page.getByRole('button', { name: '创建专辑' }).click()
    await expect(page.getByRole('heading', { name: '2049' })).toBeVisible()

    await page.getByRole('button', { name: /播放全专/ }).click()
    await expect(page.locator('body')).toContainText('Track One')

    await page.getByRole('link', { name: /编辑专辑/ }).click()
    await page.getByLabel('专辑标题').fill('2049 Updated')
    await page.getByRole('button', { name: '保存专辑' }).click()
    await expect(page.getByRole('heading', { name: '2049 Updated' })).toBeVisible()

    await page.goto('/artist/artist_uuid/edit')
    await page.getByLabel('艺术家名称').fill('Ye')
    await page.getByRole('button', { name: '保存艺术家' }).click()
    await expect(page.getByRole('heading', { name: 'Ye' })).toBeVisible()
  })
})
```

- [ ] **Step 2: Run mock e2e to verify it fails**

Run:

```bash
bun run test:e2e -- tests/e2e/specs/music-wiki.mock.spec.ts
```

Expected: FAIL on missing routes/forms before implementation, or Playwright browser missing if local environment lacks browsers. If browsers are missing, run `bunx playwright install chromium` only after user approval because it downloads binaries.

- [ ] **Step 3: Fix selectors and flow to match implemented UI**

Adjust the test only when the implementation has equivalent accessible labels. Do not weaken assertions to `body` visibility.

- [ ] **Step 4: Run mock e2e to verify pass**

Run:

```bash
bun run test:e2e -- tests/e2e/specs/music-wiki.mock.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/specs/music-wiki.mock.spec.ts tests/e2e/fixtures/base.ts
git commit -m "Add mocked music wiki e2e flow"
```

---

## Task 10: Add real-backend fixture discovery for `Downloads/2049`

**Files:**
- Create: `tests/e2e/helpers/music-fixtures.ts`
- Create: `tests/e2e/specs/music-wiki.real.spec.ts`

- [ ] **Step 1: Write fixture helper tests through the real e2e preflight path**

Create `tests/e2e/helpers/music-fixtures.ts`:

```ts
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export type MusicAlbumFixture = {
  albumDir: string
  audioFiles: string[]
  coverFile?: string
}

const audioExtensions = new Set(['.mp3', '.m4a', '.wav', '.flac', '.aac', '.ogg'])
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : ''
}

export function findMusic2049Fixture(homeDir = process.env.HOME || ''): MusicAlbumFixture {
  const albumDir = join(homeDir, 'Downloads', '2049')
  if (!existsSync(albumDir)) {
    throw new Error(`Missing album fixture directory: ${albumDir}`)
  }

  const files = readdirSync(albumDir).map((fileName) => join(albumDir, fileName))
  const audioFiles = files.filter((file) => audioExtensions.has(extensionOf(file)))
  const coverFile = files.find((file) => imageExtensions.has(extensionOf(file)))

  if (audioFiles.length === 0) {
    throw new Error(`Missing audio files in: ${albumDir}`)
  }

  return { albumDir, audioFiles, coverFile }
}
```

Create `tests/e2e/specs/music-wiki.real.spec.ts` with a skipped preflight first:

```ts
import { test, expect } from '../fixtures/base'
import { findMusic2049Fixture } from '../helpers/music-fixtures'

test.describe('Music wiki flow against real backend', () => {
  test('preflight finds local Kanye 2049 fixture', async () => {
    const fixture = findMusic2049Fixture()
    expect(fixture.audioFiles.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run preflight test**

Run:

```bash
bun run test:e2e -- tests/e2e/specs/music-wiki.real.spec.ts
```

Expected: PASS if `Downloads/2049` exists with audio files; otherwise FAIL with a clear missing fixture message.

- [ ] **Step 3: Commit helper if preflight passes**

```bash
git add tests/e2e/helpers/music-fixtures.ts tests/e2e/specs/music-wiki.real.spec.ts
git commit -m "Add music real-backend fixture preflight"
```

---

## Task 11: Add real-backend Playwright wiki flow

**Files:**
- Modify: `tests/e2e/specs/music-wiki.real.spec.ts`

- [ ] **Step 1: Write the real-backend flow**

Replace `tests/e2e/specs/music-wiki.real.spec.ts` with:

```ts
import { test, expect } from '../fixtures/base'
import { findMusic2049Fixture } from '../helpers/music-fixtures'

test.describe('Music wiki flow against real backend', () => {
  test('registers user, creates and edits artist and album, uploads audio, and plays', async ({ page, request }) => {
    const backend = await request.get('http://localhost:8080/api/v1/site/access')
    expect(backend.ok(), 'localhost:8080 backend must be reachable').toBeTruthy()

    const fixture = findMusic2049Fixture()
    const stamp = Date.now()
    const email = `e2e-music-${stamp}@atoman.test`
    const username = `e2e_music_${stamp}`
    const password = 'password123'
    const artistName = `e2e Kanye ${stamp}`
    const updatedArtistName = `e2e Ye ${stamp}`
    const albumTitle = `e2e 2049 ${stamp}`
    const updatedAlbumTitle = `e2e 2049 Updated ${stamp}`

    await page.goto('/register')
    await page.getByPlaceholder('输入邮箱').fill(email)
    await page.getByPlaceholder('输入用户名').fill(username)
    await page.getByPlaceholder('输入密码').fill(password)
    await page.getByPlaceholder('再次输入密码').fill(password)
    await page.getByRole('button', { name: /注 册|加入我们|注册/ }).click()

    await page.goto('/artist/new')
    await page.getByLabel('艺术家名称').fill(artistName)
    await page.getByLabel('艺术家简介').fill('Created by music wiki real-backend e2e.')
    await page.getByRole('button', { name: '创建艺术家' }).click()
    await expect(page.getByRole('heading', { name: artistName })).toBeVisible({ timeout: 15000 })

    await page.getByRole('link', { name: /添加新专辑/ }).click()
    await page.getByLabel('专辑标题').fill(albumTitle)
    await page.getByLabel('发行日期').fill('2026-06-15')
    await page.getByLabel('专辑简介').fill('Created from Downloads/2049 by e2e.')
    await page.getByLabel('曲目 1 标题').fill('2049 Track 1')
    await page.getByLabel('曲目 1 音频文件').setInputFiles(fixture.audioFiles[0])
    await page.getByRole('button', { name: '创建专辑' }).click()
    await expect(page.getByRole('heading', { name: albumTitle })).toBeVisible({ timeout: 30000 })

    await page.getByRole('button', { name: /播放全专/ }).click()
    await expect(page.locator('body')).toContainText('2049 Track 1')

    await page.getByRole('link', { name: /编辑专辑/ }).click()
    await page.getByLabel('专辑标题').fill(updatedAlbumTitle)
    await page.getByRole('button', { name: '保存专辑' }).click()
    await expect(page.getByRole('heading', { name: updatedAlbumTitle })).toBeVisible({ timeout: 15000 })

    await page.goto(page.url().replace(/\/album\/[^/?]+.*/, `/artist/${await page.evaluate(() => localStorage.getItem('lastCreatedArtistId') || '')}/edit`))
    if (page.url().endsWith('/artist//edit')) {
      await page.goto('/')
      await page.getByText(artistName).click()
      await page.getByRole('link', { name: /编辑艺术家/ }).click()
    }
    await page.getByLabel('艺术家名称').fill(updatedArtistName)
    await page.getByRole('button', { name: '保存艺术家' }).click()
    await expect(page.getByRole('heading', { name: updatedArtistName })).toBeVisible({ timeout: 15000 })
  })
})
```

- [ ] **Step 2: Run real-backend e2e to verify it fails at the current broken point**

Run:

```bash
VITE_API_URL=http://localhost:8080 bun run test:e2e -- tests/e2e/specs/music-wiki.real.spec.ts
```

Expected before full implementation: FAIL at the first missing page/form/API mismatch. After implementation: PASS. If it fails with API contract errors because backend lacks wiki endpoints, report the exact endpoint and response.

- [ ] **Step 3: Improve artist id tracking without localStorage hack**

If real flow cannot navigate back to the artist edit page reliably, update the implementation so after artist creation the app routes to `/artist/:id`, and the test captures that URL:

```ts
await expect(page).toHaveURL(/\/artist\/[^/?]+/)
const artistUrl = page.url()
const artistEditUrl = artistUrl.replace(/\/artist\/([^/?]+).*/, '/artist/$1/edit')
```

Then use:

```ts
await page.goto(artistEditUrl)
```

- [ ] **Step 4: Run real-backend e2e again**

Run:

```bash
VITE_API_URL=http://localhost:8080 bun run test:e2e -- tests/e2e/specs/music-wiki.real.spec.ts
```

Expected: PASS with retained database records named with `e2e` and the timestamp.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/specs/music-wiki.real.spec.ts
git commit -m "Add real backend music wiki e2e flow"
```

---

## Task 12: Full verification and cleanup

**Files:**
- No new source files unless tests expose a defect.

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
bun run test:unit -- tests/unit/api/musicV1.spec.ts tests/unit/views/music/MusicHomeView.spec.ts tests/unit/views/music/MusicArtistForm.spec.ts tests/unit/views/music/MusicAlbumForm.spec.ts tests/unit/views/music/ArtistDetailView.spec.ts tests/unit/views/music/AlbumDetailView.spec.ts tests/unit/stores/player.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run music mock e2e**

Run:

```bash
bun run test:e2e -- tests/e2e/specs/music-wiki.mock.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run music real-backend e2e**

Run:

```bash
VITE_API_URL=http://localhost:8080 bun run test:e2e -- tests/e2e/specs/music-wiki.real.spec.ts
```

Expected: PASS, or a clear API contract failure naming the backend endpoint that does not support wiki mode.

- [ ] **Step 4: Run project type check**

Run:

```bash
bun run type-check
```

Expected: PASS.

- [ ] **Step 5: Run production build**

Run:

```bash
bun run build
```

Expected: PASS.

- [ ] **Step 6: Final commit**

If the previous tasks left any verified changes uncommitted:

```bash
git status --short
git add <only-files-from-this-plan>
git commit -m "Complete music wiki flow verification"
```

Do not stage unrelated existing workspace changes.

---

## Self-Review

### Spec coverage

- Register test user: covered by Task 9 mock e2e and Task 11 real e2e.
- Create artist: covered by Tasks 1, 5, 9, 11.
- Create album: covered by Tasks 3, 6, 9, 11.
- Upload real audio from `Downloads/2049`: covered by Tasks 7, 10, 11.
- Play uploaded music: covered by Tasks 6, 9, 11.
- Edit artist and album immediately: covered by Tasks 5, 6, 9, 11.
- No review/admin flow: covered by API helper choices and Task 8 placeholder removal.
- Mock first, real backend second: covered by Tasks 9 before 10/11.
- Keep real test data: Task 11 does not clean up generated records.

### Placeholder scan

The plan contains no `TBD` or `TODO` markers. Code snippets define concrete paths, commands, and expected outcomes.

### Type consistency

`MusicArtistInput`, `MusicAlbumInput`, `MusicTrackInput`, `MusicAlbum`, and `MusicArtist` are introduced in `src/api/musicV1.ts` before use in components. Routes use `/artist/:id`, `/artist/:artistId/album/new`, and `/album/:id` consistently.
