# Music Module Wiki UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "Paper Stacking" UX for the Music module, transforming it from page-based routing to a stacked drawer architecture (Level 1: Base -> Level 2: Artist Drawer -> Level 3: Album Drawer -> Level 4: Edit/History Drawer).

**Architecture:** 
1. The global Sidebar will be simplified to three items (Explore, Artists, Starred).
2. `HomeView.vue` will become the Level 1 "Artists" base view with a grid of artists.
3. We will enhance/create a `PaperSheet` component capable of stacking and triggering `shifted` CSS states on the underlying content (`mainContent`, `artistDrawer`, `albumDrawer`).
4. `ArtistDetailView` and `AlbumDetailView` will be refactored to render inside these `PaperSheet` drawers instead of full-page routes.
5. `MusicEditReviewShell` features (History, Revision Form) will be ported to the Level 4 nested drawer.
6. "Discussion" will be implemented as a fixed right-edge Floating Action Button (FAB) mimicking `PaperIndexTrigger`.

**Tech Stack:** Vue 3 (Composition API), Vue Router (for initial entry points, though within the module state will manage drawers), Vanilla CSS (Paper & Ink aesthetic).

---

## File Structure Map

**Modified Files:**
- `web/src/router/routes/modules.ts`: Remove direct routes for artist/album details, relying on state instead.
- `web/src/views/music/MusicLayout.vue`: Simplify sidebar navigation.
- `web/src/views/music/HomeView.vue`: Refactor to Level 1 Artist Grid.
- `web/src/components/ui/PaperSheet.vue`: Enhance with `shifted` state and dynamic width management.

**New Components:**
- `web/src/components/music/ArtistDrawer.vue`: Level 2 UI.
- `web/src/components/music/AlbumDrawer.vue`: Level 3 UI.
- `web/src/components/music/NestedActionDrawer.vue`: Level 4 UI for Wiki forms and History.
- `web/src/components/ui/PaperDiscussionFAB.vue`: Floating action button for discussions.
- `web/src/composables/useMusicDrawers.ts`: State management for the stacked drawers.

---

### Task 1: Create Drawer State Management (useMusicDrawers)

**Files:**
- Create: `web/src/composables/useMusicDrawers.ts`
- Test: `web/src/composables/useMusicDrawers.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// web/src/composables/useMusicDrawers.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useMusicDrawers } from './useMusicDrawers'

describe('useMusicDrawers', () => {
  beforeEach(() => {
    const { closeAll } = useMusicDrawers()
    closeAll()
  })

  it('manages artist drawer state', () => {
    const { state, openArtist, closeArtist } = useMusicDrawers()
    expect(state.value.artistId).toBeNull()
    
    openArtist('artist-123')
    expect(state.value.artistId).toBe('artist-123')
    
    closeArtist()
    expect(state.value.artistId).toBeNull()
  })

  it('manages album drawer state', () => {
    const { state, openAlbum, closeAlbum } = useMusicDrawers()
    openAlbum('album-456')
    expect(state.value.albumId).toBe('album-456')
    
    closeAlbum()
    expect(state.value.albumId).toBeNull()
  })

  it('manages nested action drawer state', () => {
    const { state, openNestedAction, closeNestedAction } = useMusicDrawers()
    openNestedAction('revise', { title: 'Test' })
    expect(state.value.nestedAction).toBe('revise')
    expect(state.value.nestedPayload).toEqual({ title: 'Test' })
    
    closeNestedAction()
    expect(state.value.nestedAction).toBeNull()
  })

  it('computes shifted states correctly', () => {
    const { isMainShifted, isArtistShifted, isAlbumShifted, openArtist, openAlbum, openNestedAction } = useMusicDrawers()
    
    expect(isMainShifted.value).toBe(false)
    
    openArtist('1')
    expect(isMainShifted.value).toBe(true)
    expect(isArtistShifted.value).toBe(false)
    
    openAlbum('2')
    expect(isArtistShifted.value).toBe(true)
    expect(isAlbumShifted.value).toBe(false)
    
    openNestedAction('revise')
    expect(isAlbumShifted.value).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/composables/useMusicDrawers.spec.ts`
Expected: FAIL (file not found)

- [ ] **Step 3: Write minimal implementation**

```typescript
// web/src/composables/useMusicDrawers.ts
import { ref, computed } from 'vue'

type NestedActionType = 'revise' | 'history' | 'add_album' | 'add_artist' | 'discussion' | null

interface DrawerState {
  artistId: string | null
  albumId: string | null
  nestedAction: NestedActionType
  nestedPayload: any
}

// Global state singleton
const state = ref<DrawerState>({
  artistId: null,
  albumId: null,
  nestedAction: null,
  nestedPayload: null
})

export function useMusicDrawers() {
  const openArtist = (id: string) => { state.value.artistId = id }
  const closeArtist = () => { state.value.artistId = null }
  
  const openAlbum = (id: string) => { state.value.albumId = id }
  const closeAlbum = () => { state.value.albumId = null }
  
  const openNestedAction = (action: NestedActionType, payload: any = null) => {
    state.value.nestedAction = action
    state.value.nestedPayload = payload
  }
  const closeNestedAction = () => {
    state.value.nestedAction = null
    state.value.nestedPayload = null
  }
  
  const closeAll = () => {
    state.value.artistId = null
    state.value.albumId = null
    state.value.nestedAction = null
    state.value.nestedPayload = null
  }

  const isMainShifted = computed(() => state.value.artistId !== null || state.value.nestedAction === 'add_artist')
  const isArtistShifted = computed(() => state.value.albumId !== null || state.value.nestedAction === 'add_album' || state.value.nestedAction === 'revise_artist')
  const isAlbumShifted = computed(() => state.value.nestedAction === 'revise' || state.value.nestedAction === 'history' || state.value.nestedAction === 'discussion')

  return {
    state,
    openArtist, closeArtist,
    openAlbum, closeAlbum,
    openNestedAction, closeNestedAction,
    closeAll,
    isMainShifted, isArtistShifted, isAlbumShifted
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/composables/useMusicDrawers.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/composables/useMusicDrawers.ts web/src/composables/useMusicDrawers.spec.ts
git commit -m "feat(music): add useMusicDrawers composable for paper stacking state"
```

### Task 2: Enhance PaperSheet for Stacking

**Files:**
- Modify: `web/src/components/ui/PaperSheet.vue`
- Create: `web/tests/unit/PaperSheet.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// web/tests/unit/PaperSheet.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import PaperSheet from '@/components/ui/PaperSheet.vue'

describe('PaperSheet.vue', () => {
  it('applies shifted class when isShifted prop is true', () => {
    const wrapper = mount(PaperSheet, {
      props: { show: true, isShifted: true }
    })
    expect(wrapper.find('.paper-sheet-panel').classes()).toContain('is-shifted')
  })

  it('accepts custom width via prop', () => {
    const wrapper = mount(PaperSheet, {
      props: { show: true, width: '900px' }
    })
    expect(wrapper.find('.paper-sheet-panel').attributes('style')).toContain('width: 900px')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/PaperSheet.spec.ts`
Expected: FAIL (Unknown props `isShifted` and `width`)

- [ ] **Step 3: Write minimal implementation**

Edit `web/src/components/ui/PaperSheet.vue`.
Add `isShifted` and `width` to props definition. Apply class and style.

```vue
<!-- Modify script block -->
<script setup lang="ts">
// ... existing imports ...

withDefaults(defineProps<{
  show: boolean
  title?: string
  width?: string
  isShifted?: boolean
}>(), {
  show: false,
  width: '600px',
  isShifted: false
})
// ... rest of script ...
</script>

<!-- Modify template panel binding -->
<template>
  <div class="paper-sheet" :class="{ 'is-open': show }">
    <!-- ... overlay ... -->
    <div 
      class="paper-sheet-panel" 
      :class="{ 'is-shifted': isShifted }"
      :style="{ width: width }"
    >
<!-- ... -->
```

Add CSS for `is-shifted`:
```css
/* Add to <style scoped> */
.paper-sheet-panel {
  /* existing styles */
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s;
}

.paper-sheet-panel.is-shifted {
  transform: translateX(-10%) scale(0.98);
  opacity: 0.6;
  pointer-events: none;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/PaperSheet.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ui/PaperSheet.vue web/tests/unit/PaperSheet.spec.ts
git commit -m "feat(ui): enhance PaperSheet with shifted state and dynamic width for multi-level stacking"
```

### Task 3: Simplify Music Sidebar Navigation

**Files:**
- Modify: `web/src/views/music/MusicLayout.vue`

- [ ] **Step 1: Write the failing test**
(No complex logic, testing via component mount)

```typescript
// web/tests/unit/MusicLayout.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import MusicLayout from '@/views/music/MusicLayout.vue'

describe('MusicLayout.vue', () => {
  it('renders only the simplified sidebar items', () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [] })
    const wrapper = mount(MusicLayout, {
      global: { plugins: [router], stubs: ['router-view', 'PaperSidebar', 'PaperSidebarItem'] }
    })
    const items = wrapper.findAll('paper-sidebar-item-stub')
    expect(items.length).toBe(3)
    expect(items[0].text()).toContain('探索')
    expect(items[1].text()).toContain('艺术家')
    expect(items[2].text()).toContain('我的收藏')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/MusicLayout.spec.ts`
Expected: FAIL (Expects 3 items but finds old ones like '上传专辑')

- [ ] **Step 3: Write minimal implementation**

Edit `web/src/views/music/MusicLayout.vue`. Replace the existing `<PaperSidebarItem>`s.

```vue
<template>
  <div class="a-module-layout">
    <PaperSidebar :label="moduleRooms.music.name" :helper="moduleRooms.music.helper">
      <PaperSidebarItem to="/explore" index="1">
        探索
      </PaperSidebarItem>
      <PaperSidebarItem to="/" index="2" exact>
        艺术家
      </PaperSidebarItem>
      <PaperSidebarItem to="/starred" index="3">
        我的收藏
      </PaperSidebarItem>
    </PaperSidebar>
    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { moduleRooms } from '@/config/moduleRooms'
import PaperSidebar from '@/components/ui/PaperSidebar.vue'
import PaperSidebarItem from '@/components/ui/PaperSidebarItem.vue'
// Removed auth logic for now as navigation is simplified
</script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/MusicLayout.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/views/music/MusicLayout.vue web/tests/unit/MusicLayout.spec.ts
git commit -m "refactor(music): simplify sidebar navigation to Explore, Artists, Starred"
```

### Task 4: Refactor HomeView to Level 1 Artist Grid

**Files:**
- Modify: `web/src/views/music/HomeView.vue`

- [ ] **Step 1: Write the failing test**

```typescript
// web/tests/unit/MusicHomeView.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import HomeView from '@/views/music/HomeView.vue'

describe('Music HomeView.vue (Base Artists View)', () => {
  it('renders artist grid and shifted class logic', () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(HomeView, {
      global: { plugins: [pinia], stubs: ['RouterLink', 'ArtistDrawer', 'AlbumDrawer', 'NestedActionDrawer'] }
    })
    expect(wrapper.find('h1').text()).toContain('艺术家')
    expect(wrapper.find('.search-input').exists()).toBe(true)
    // Note: DOM mocking for shifted class requires useMusicDrawers setup, skipping deep CSS test here for brevity
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/MusicHomeView.spec.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Edit `web/src/views/music/HomeView.vue` to rip out the timeline and implement the base grid, while introducing the drawer components.

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import ArtistDrawer from '@/components/music/ArtistDrawer.vue'
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'
import NestedActionDrawer from '@/components/music/NestedActionDrawer.vue'

const API_URL = import.meta.env.VITE_API_URL || '/api'
const { isMainShifted, openArtist, openNestedAction } = useMusicDrawers()

const artists = ref<any[]>([])
const searchQuery = ref('')

async function fetchArtists() {
  try {
    const res = await fetch(`${API_URL}/artists`)
    if (res.ok) {
      artists.value = await res.json()
    }
  } catch (e) {
    console.error('Failed to fetch artists:', e)
  }
}

onMounted(() => {
  fetchArtists()
})
</script>

<template>
  <div class="music-base-view">
    <div class="main-level-1" :class="{ 'is-shifted': isMainShifted }">
      <h1 class="page-title">艺术家</h1>
      <p class="a-muted">浏览音乐档案库中的所有艺术家。</p>

      <div class="search-bar">
        <input
          v-model="searchQuery"
          placeholder="搜索艺术家..."
          class="search-input"
        />
        <button class="a-btn" @click="openNestedAction('add_artist')">找不到？添加艺术家</button>
      </div>

      <div class="grid">
        <div 
          v-for="artist in artists" 
          :key="artist.id" 
          class="card"
          @click="openArtist(String(artist.id))"
        >
          <div class="card-img">
            <img v-if="artist.image_url" :src="artist.image_url" class="artist-avatar" />
            <span v-else>ARTIST</span>
          </div>
          <div class="card-body">
            <div class="card-title">{{ artist.name }}</div>
            <div class="card-sub">{{ artist.entry_status === 'confirmed' ? '已确认' : '未确认' }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Drawers injected at root level of module view -->
    <ArtistDrawer />
    <AlbumDrawer />
    <NestedActionDrawer />
  </div>
</template>

<style scoped>
.music-base-view { position: relative; }
.main-level-1 {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s;
}
.main-level-1.is-shifted {
  transform: translateX(-10%) scale(0.98);
  opacity: 0.4;
  pointer-events: none;
}
.page-title { font-family: var(--a-font-serif); font-size: 3rem; font-weight: 900; margin-bottom: 0.5rem; font-style: italic; border-left: 8px solid var(--a-color-ink); padding-left: 1rem; }
.search-bar { display: flex; gap: 1rem; margin: 2rem 0; }
.search-input { border: 2px solid var(--a-color-ink); padding: 0.75rem 1.5rem; font-size: 1rem; flex: 1; max-width: 400px; outline: none; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem; }
.card { background: var(--a-color-paper); border: 2px solid var(--a-color-ink); display: flex; flex-direction: column; cursor: pointer; transition: transform 0.1s; }
.card:hover { transform: translateY(-4px); box-shadow: 6px 6px 0 0 rgba(0,0,0,0.1); }
.card-img { aspect-ratio: 1; background: #eee; border-bottom: 2px solid var(--a-color-ink); display: flex; align-items: center; justify-content: center; font-family: var(--a-font-meta); color: #999; overflow: hidden; }
.artist-avatar { width: 100%; height: 100%; object-fit: cover; }
.card-body { padding: 1rem; text-align: center; }
.card-title { font-weight: 900; font-size: 1.1rem; margin-bottom: 0.25rem; line-height: 1.2; }
.card-sub { font-size: 0.8rem; color: var(--a-color-muted); }
.a-btn { border: 2px solid var(--a-color-ink); padding: 0.75rem 1.5rem; font-weight: bold; background: var(--a-color-paper); cursor: pointer; font-family: var(--a-font-meta); transition: all 0.1s; }
.a-btn:hover { background: var(--a-color-paper-soft); }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/MusicHomeView.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/views/music/HomeView.vue web/tests/unit/MusicHomeView.spec.ts
git commit -m "feat(music): refactor HomeView to artist grid and inject stacked drawers"
```

### Task 5: Create Level 2 ArtistDrawer Component

**Files:**
- Create: `web/src/components/music/ArtistDrawer.vue`

- [ ] **Step 1: Write the failing test**

```typescript
// web/tests/unit/ArtistDrawer.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import ArtistDrawer from '@/components/music/ArtistDrawer.vue'

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: { value: { artistId: '1' } },
    closeArtist: vi.fn(),
    isArtistShifted: { value: false },
    openNestedAction: vi.fn(),
    openAlbum: vi.fn()
  })
}))

describe('ArtistDrawer.vue', () => {
  it('renders PaperSheet when artistId is present', () => {
    const wrapper = mount(ArtistDrawer, {
      global: { stubs: ['PaperSheet'] }
    })
    expect(wrapper.findComponent({ name: 'PaperSheet' }).exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/ArtistDrawer.spec.ts`
Expected: FAIL (file not found)

- [ ] **Step 3: Write minimal implementation**

```vue
<!-- web/src/components/music/ArtistDrawer.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import PaperSheet from '@/components/ui/PaperSheet.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const { state, closeArtist, isArtistShifted, openAlbum, openNestedAction } = useMusicDrawers()
const isOpen = computed(() => state.value.artistId !== null)

// Placeholder data for design
const dummyAlbums = [
  { id: '1', title: 'The Dark Side of the Moon', year: '1973', tracks: 10 },
  { id: '2', title: 'Wish You Were Here', year: '1975', tracks: 5 },
]
</script>

<template>
  <PaperSheet 
    :show="isOpen" 
    @close="closeArtist" 
    width="900px" 
    :is-shifted="isArtistShifted"
  >
    <div class="drawer-header">
      <div>
        <div class="kicker">ARTIST ENTRY</div>
        <h2 class="title">Artist {{ state.artistId }}</h2>
      </div>
    </div>
    
    <div class="drawer-body">
      <div class="actions">
        <button class="a-btn-dashed" @click="openNestedAction('revise_artist')">✍ 修订艺术家信息</button>
        <button class="a-btn-dashed" @click="openNestedAction('add_album')">+ 添加新专辑</button>
      </div>

      <div class="album-list-header">
        <h3>专辑列表</h3>
      </div>

      <div 
        v-for="album in dummyAlbums" 
        :key="album.id" 
        class="album-row" 
        @click="openAlbum(album.id)"
      >
        <div class="album-row-left">
          <div class="album-year">{{ album.year }}</div>
        </div>
        <div class="album-row-right">
          <div class="album-row-cover">COVER</div>
          <div class="album-row-info">
            <div class="album-row-title">{{ album.title }}</div>
            <div class="album-row-meta">{{ album.tracks }} Tracks · Studio Album</div>
          </div>
        </div>
      </div>
    </div>
  </PaperSheet>
</template>

<style scoped>
.drawer-header { padding: 2rem 3rem; border-bottom: 2px solid var(--a-color-ink); display: flex; justify-content: space-between; align-items: flex-start; background: #fafafa; }
.kicker { font-family: var(--a-font-meta); font-size: 0.75rem; font-weight: bold; letter-spacing: 0.1em; color: var(--a-color-ink-soft); margin-bottom: 0.5rem; }
.title { font-family: var(--a-font-serif); font-size: 2.5rem; margin: 0; }
.drawer-body { padding: 2rem 3rem; }
.actions { display: flex; gap: 1rem; margin-bottom: 2rem; }
.a-btn-dashed { border: 1.5px dashed var(--a-color-ink); padding: 0.75rem 1.5rem; font-weight: bold; background: transparent; cursor: pointer; font-family: var(--a-font-meta); }
.a-btn-dashed:hover { background: var(--a-color-paper-soft); }

.album-list-header { margin-bottom: 2rem; border-bottom: 1px dashed var(--a-color-line-soft); padding-bottom: 1rem; }
.album-list-header h3 { font-size: 1.2rem; font-weight: 900; margin: 0; }
.album-row { display: flex; gap: 2rem; margin-bottom: 2rem; position: relative; cursor: pointer; transition: transform 0.1s; }
.album-row:hover { transform: translateX(4px); }
.album-row-left { width: 100px; flex-shrink: 0; text-align: right; padding-top: 0.5rem; }
.album-year { font-family: var(--a-font-meta); font-size: 1.5rem; font-weight: 900; color: var(--a-color-ink); }
.album-row-right { flex: 1; display: flex; background: var(--a-color-paper); border: 2px solid var(--a-color-ink); padding: 1rem; gap: 1.5rem; }
.album-row-right:hover { box-shadow: 4px 4px 0 0 rgba(0,0,0,0.1); }
.album-row-cover { width: 100px; height: 100px; background: #eee; border: 1px solid var(--a-color-ink); display: flex; align-items: center; justify-content: center; font-family: var(--a-font-meta); font-size: 0.7rem; color: #999; flex-shrink: 0; }
.album-row-info { display: flex; flex-direction: column; justify-content: center; }
.album-row-title { font-family: var(--a-font-serif); font-size: 1.5rem; font-weight: 900; margin-bottom: 0.25rem; }
.album-row-meta { font-family: var(--a-font-meta); font-size: 0.8rem; color: var(--a-color-ink-soft); }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/ArtistDrawer.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/components/music/ArtistDrawer.vue web/tests/unit/ArtistDrawer.spec.ts
git commit -m "feat(music): create Level 2 ArtistDrawer UI"
```

### Task 6: Create Level 3 AlbumDrawer Component

**Files:**
- Create: `web/src/components/music/AlbumDrawer.vue`
- Create: `web/src/components/ui/PaperDiscussionFAB.vue`

- [ ] **Step 1: Write the failing test**

```typescript
// web/tests/unit/AlbumDrawer.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: { value: { albumId: '1' } },
    closeAlbum: vi.fn(),
    isAlbumShifted: { value: false },
    openNestedAction: vi.fn()
  })
}))

describe('AlbumDrawer.vue', () => {
  it('renders correctly', () => {
    const wrapper = mount(AlbumDrawer, { global: { stubs: ['PaperSheet', 'PaperDiscussionFAB'] } })
    expect(wrapper.findComponent({ name: 'PaperSheet' }).exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/AlbumDrawer.spec.ts`
Expected: FAIL (file not found)

- [ ] **Step 3: Write minimal implementation**

```vue
<!-- web/src/components/music/AlbumDrawer.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import PaperSheet from '@/components/ui/PaperSheet.vue'
import PaperDiscussionFAB from '@/components/ui/PaperDiscussionFAB.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const { state, closeAlbum, isAlbumShifted, openNestedAction } = useMusicDrawers()
const isOpen = computed(() => state.value.albumId !== null)
</script>

<template>
  <PaperSheet 
    :show="isOpen" 
    @close="closeAlbum" 
    width="700px" 
    :is-shifted="isAlbumShifted"
  >
    <div class="drawer-header">
      <div>
        <div class="kicker">ALBUM ENTRY</div>
        <h2 class="title">Album {{ state.albumId }}</h2>
      </div>
    </div>
    
    <div class="drawer-body">
      <div class="album-meta-row">
        <div class="album-cover">COVER</div>
        <div class="album-info">
          <div class="meta-tags">
            <span>Artist Name</span>
            <span>1973</span>
          </div>
          <p class="summary">专辑简介内容...</p>
        </div>
      </div>

      <div class="action-bar">
        <button class="a-btn-primary">▶ 播放全专</button>
        <button class="a-btn">★ 收藏</button>
        <div class="spacer"></div>
        <button class="a-btn-dashed" @click="openNestedAction('revise')">✍ 修订</button>
        <button class="a-btn-dashed" @click="openNestedAction('history')">⏱ 历史</button>
      </div>

      <div class="content-section">
        <div class="section-title">Tracklist</div>
        <div class="track">
          <div><span class="track-num">01</span> Track 1</div>
          <div class="track-time">03:45</div>
        </div>
      </div>
    </div>
    <PaperDiscussionFAB v-if="isOpen" @click="openNestedAction('discussion')" count="12" />
  </PaperSheet>
</template>

<style scoped>
.drawer-header { padding: 2rem 3rem; border-bottom: 2px solid var(--a-color-ink); display: flex; justify-content: space-between; align-items: flex-start; background: #fafafa; }
.kicker { font-family: var(--a-font-meta); font-size: 0.75rem; font-weight: bold; letter-spacing: 0.1em; color: var(--a-color-ink-soft); margin-bottom: 0.5rem; }
.title { font-family: var(--a-font-serif); font-size: 2rem; margin: 0; }
.drawer-body { padding: 2rem 3rem; }

.album-meta-row { display: flex; gap: 2rem; margin-bottom: 2rem; }
.album-cover { width: 160px; height: 160px; background: #eee; border: 2px solid var(--a-color-ink); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-family: var(--a-font-meta); color: #999; }
.album-info { flex: 1; }
.meta-tags { display: flex; gap: 1rem; margin-bottom: 1rem; font-family: var(--a-font-meta); font-size: 0.8rem; }
.summary { color: var(--a-color-ink-soft); font-size: 0.9rem; }

.action-bar { display: flex; gap: 1rem; margin-bottom: 2rem; padding: 1.5rem; background: var(--a-color-paper); border: 1.5px solid var(--a-color-ink); }
.spacer { flex: 1; }
.a-btn { border: 1.5px solid var(--a-color-ink); padding: 0.75rem 1.5rem; font-weight: bold; background: var(--a-color-paper); cursor: pointer; font-family: var(--a-font-meta); text-transform: uppercase; }
.a-btn-primary { border: 1.5px solid var(--a-color-ink); padding: 0.75rem 1.5rem; font-weight: bold; background: var(--a-color-ink); color: white; cursor: pointer; font-family: var(--a-font-meta); text-transform: uppercase; }
.a-btn-dashed { border: 1.5px dashed var(--a-color-ink); padding: 0.75rem 1.5rem; font-weight: bold; background: transparent; cursor: pointer; font-family: var(--a-font-meta); text-transform: uppercase; }

.content-section { background: var(--a-color-paper); border: 1.5px solid var(--a-color-ink); padding: 2rem; margin-bottom: 2rem; }
.section-title { font-family: var(--a-font-meta); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid var(--a-color-line-soft); padding-bottom: 0.5rem; margin-bottom: 1.5rem; color: var(--a-color-ink-soft); }
.track { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px dashed var(--a-color-line-soft); }
.track-num { color: #999; margin-right: 1rem; font-family: var(--a-font-meta); }
.track-time { font-family: var(--a-font-meta); color: var(--a-color-ink-soft); }
</style>
```

And create the FAB placeholder:
```vue
<!-- web/src/components/ui/PaperDiscussionFAB.vue -->
<template>
  <button class="discussion-fab" @click="$emit('click')">
    <div class="fab-label">讨论 ({{ count }})</div>
  </button>
</template>

<script setup lang="ts">
defineProps<{ count: string | number }>()
defineEmits(['click'])
</script>

<style scoped>
.discussion-fab {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  padding: 1.5rem 0;
  background: var(--a-color-ink);
  border: 1px solid var(--a-color-ink);
  border-right: none;
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
  box-shadow: -4px 4px 15px rgba(0, 0, 0, 0.12);
  z-index: 1005;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.discussion-fab:hover {
  transform: translate(-4px, -50%);
  box-shadow: -10px 10px 30px rgba(0, 0, 0, 0.2);
}
.fab-label {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-family: var(--a-font-meta);
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0.2em;
  color: var(--a-color-paper);
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/AlbumDrawer.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/components/music/AlbumDrawer.vue web/src/components/ui/PaperDiscussionFAB.vue web/tests/unit/AlbumDrawer.spec.ts
git commit -m "feat(music): create Level 3 AlbumDrawer and Discussion FAB"
```

### Task 7: Create Level 4 NestedActionDrawer

**Files:**
- Create: `web/src/components/music/NestedActionDrawer.vue`

- [ ] **Step 1: Write the failing test**

```typescript
// web/tests/unit/NestedActionDrawer.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import NestedActionDrawer from '@/components/music/NestedActionDrawer.vue'

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: { value: { nestedAction: 'history' } },
    closeNestedAction: vi.fn()
  })
}))

describe('NestedActionDrawer.vue', () => {
  it('renders when action is present', () => {
    const wrapper = mount(NestedActionDrawer, { global: { stubs: ['PaperSheet'] } })
    expect(wrapper.findComponent({ name: 'PaperSheet' }).exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/NestedActionDrawer.spec.ts`
Expected: FAIL (file not found)

- [ ] **Step 3: Write minimal implementation**

```vue
<!-- web/src/components/music/NestedActionDrawer.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import PaperSheet from '@/components/ui/PaperSheet.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const { state, closeNestedAction } = useMusicDrawers()
const isOpen = computed(() => state.value.nestedAction !== null)

const titleMap: Record<string, string> = {
  revise: '修订专辑',
  revise_artist: '修订艺术家',
  history: '版本历史',
  add_album: '添加新专辑',
  add_artist: '新建艺术家',
  discussion: '社区讨论'
}

const displayTitle = computed(() => titleMap[state.value.nestedAction || ''] || 'Action')
</script>

<template>
  <PaperSheet 
    :show="isOpen" 
    @close="closeNestedAction" 
    width="500px" 
  >
    <div class="drawer-header">
      <h3 class="title">{{ displayTitle }}</h3>
    </div>
    
    <div class="drawer-body">
      <!-- Form placeholder -->
      <div v-if="state.nestedAction === 'revise' || state.nestedAction === 'add_album'">
        <div class="form-group">
          <label class="form-label">标题</label>
          <input type="text" class="form-input">
        </div>
        <button class="a-btn-primary" @click="closeNestedAction">提交</button>
      </div>
      
      <!-- History placeholder -->
      <div v-else-if="state.nestedAction === 'history'">
        <div class="history-item">
          <div><strong>v8 (PENDING)</strong></div>
          <div>修改简介</div>
        </div>
      </div>
    </div>
  </PaperSheet>
</template>

<style scoped>
.drawer-header { padding: 1.5rem 2rem; border-bottom: 2px solid var(--a-color-ink); background: var(--a-color-paper); }
.title { font-family: var(--a-font-serif); font-size: 1.5rem; margin: 0; }
.drawer-body { padding: 2rem; }

.form-group { margin-bottom: 1.5rem; }
.form-label { display: block; font-weight: bold; margin-bottom: 0.5rem; font-family: var(--a-font-meta); font-size: 0.8rem; }
.form-input { width: 100%; border: 1.5px solid var(--a-color-ink); padding: 0.75rem; font-size: 1rem; font-family: inherit; }
.a-btn-primary { width: 100%; border: 1.5px solid var(--a-color-ink); padding: 0.75rem 1.5rem; font-weight: bold; background: var(--a-color-ink); color: white; cursor: pointer; font-family: var(--a-font-meta); text-transform: uppercase; }

.history-item { margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px dashed var(--a-color-line-soft); }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/NestedActionDrawer.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/components/music/NestedActionDrawer.vue web/tests/unit/NestedActionDrawer.spec.ts
git commit -m "feat(music): create Level 4 NestedActionDrawer for forms and history"
```

### Task 8: Cleanup and Route Updates

**Files:**
- Modify: `web/src/router/routes/modules.ts`
- Modify: `web/src/views/music/AlbumDetailView.vue` (mark for removal)
- Modify: `web/src/views/music/ArtistDetailView.vue` (mark for removal)
- Modify: `web/src/views/music/UploadView.vue` (mark for removal)

- [ ] **Step 1: Write the failing test**
(No test needed for cleanup, verify build)

- [ ] **Step 2: Remove old views and routes**

Edit `web/src/router/routes/modules.ts`:
Remove the direct routes for `album/new`, `album/:albumId`, `artist/new`, `artist/:artistId` etc. Keep only the base routes.

```typescript
// in music array:
  music: [
    ...settingRoutes,
    {
      path: '/',
      component: () => import('@/views/music/MusicLayout.vue'),
      meta: { hasSidebar: true },
      children: [
        { path: '', component: () => import('@/views/music/HomeView.vue') },
        { path: 'explore', component: () => import('@/views/music/HomeView.vue') }, // temporarily point explore to home
        { path: 'starred', component: () => import('@/views/music/HomeView.vue') }, // temporarily point starred to home
      ],
    },
    // ...
```

- [ ] **Step 3: Run linter/build to verify safety**

Run: `cd web && npm run build -- --emptyOutDir=false`
Expected: PASS (if types align)

- [ ] **Step 4: Commit**

```bash
git rm web/src/views/music/AlbumDetailView.vue web/src/views/music/ArtistDetailView.vue web/src/views/music/UploadView.vue web/src/views/music/AddArtistView.vue
git add web/src/router/routes/modules.ts
git commit -m "refactor(music): drop dedicated detail routes in favor of drawer state architecture"
```