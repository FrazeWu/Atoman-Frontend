# Semantic Sheet Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed music drawer flags with an unbounded semantic Sheet stack that preserves entity context, browser history, focus, and mobile behavior.

**Architecture:** A generic `createSheetStack<T>()` owns only ordered layers and focus restoration. Music defines a discriminated layer union and renders one component instance per entry, allowing artist-to-artist and deeper entity chains. `PSheet` owns dialog presentation; route synchronization remains music-specific.

**Tech Stack:** Vue 3 Composition API, TypeScript, Vue Router 4, Vitest, Vue Test Utils, Bun

---

## File Map

- Create `src/composables/useSheetStack.ts` and `tests/unit/composables/useSheetStack.spec.ts`.
- Modify `src/components/ui/PSheet.vue`, `PSheetTab.vue`, and `tests/unit/system/PSheet.spec.ts`.
- Create `src/components/music/musicSheetTypes.ts` and `MusicSheetStack.vue`.
- Modify `src/composables/useMusicDrawers.ts` and its tests.
- Modify music entity/task drawers to accept explicit layer payloads.
- Preserve `MusicMergeDrawer.vue` as a dedicated merge action layer.
- Modify `MusicLayout.vue` and remove duplicate drawer mounts from music views.
- Create `src/composables/useMusicSheetRouteSync.ts` and update music route shells/tests.

### Task 1: Build the generic stack controller

**Files:**
- Create: `src/composables/useSheetStack.ts`
- Create: `tests/unit/composables/useSheetStack.spec.ts`

- [ ] **Step 1: Write the failing controller tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSheetStack, type BaseSheetLayer } from '@/composables/useSheetStack'

type TestLayer = BaseSheetLayer & {
  kind: 'artist' | 'album' | 'history'
  payload: { id: string }
}

const layer = (kind: TestLayer['kind'], id: string): TestLayer => ({
  key: `${kind}:${id}`,
  kind,
  title: `${kind} ${id}`,
  payload: { id },
})

describe('createSheetStack', () => {
  beforeEach(() => document.body.replaceChildren())

  it('pushes, replaces, pops, and returns to a retained layer', () => {
    const stack = createSheetStack<TestLayer>()
    stack.push(layer('artist', '1'))
    stack.push(layer('album', '2'))
    stack.replaceTop(layer('history', '3'))
    expect(stack.layers.value.map(item => item.key)).toEqual(['artist:1', 'history:3'])
    stack.push(layer('album', '4'))
    stack.popTo('artist:1')
    expect(stack.layers.value.map(item => item.key)).toEqual(['artist:1'])
    expect(stack.pop()?.key).toBe('artist:1')
  })

  it('allows repeated kinds but not an identical top key', () => {
    const stack = createSheetStack<TestLayer>()
    stack.push(layer('artist', '1'))
    stack.push(layer('artist', '1'))
    stack.push(layer('artist', '2'))
    expect(stack.layers.value.map(item => item.key)).toEqual(['artist:1', 'artist:2'])
  })

  it('restores trigger focus when the top layer closes', async () => {
    vi.useFakeTimers()
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const stack = createSheetStack<TestLayer>()
    stack.push(layer('artist', '1'))
    stack.pop()
    await vi.runAllTimersAsync()
    expect(document.activeElement).toBe(trigger)
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run and verify failure**

```bash
bun run test:unit -- tests/unit/composables/useSheetStack.spec.ts
```

Expected: FAIL because the composable does not exist.

- [ ] **Step 3: Implement the controller**

```ts
import { computed, shallowRef } from 'vue'

export interface BaseSheetLayer {
  key: string
  kind: string
  title: string
  route?: string
  returnFocusTo?: HTMLElement | null
}

const activeElement = () => document.activeElement instanceof HTMLElement ? document.activeElement : null

export function createSheetStack<T extends BaseSheetLayer>() {
  const layers = shallowRef<T[]>([])
  const top = computed<T | null>(() => layers.value.at(-1) ?? null)

  function push(layer: T) {
    if (top.value?.key === layer.key) return
    layers.value = [...layers.value, {
      ...layer,
      returnFocusTo: layer.returnFocusTo ?? activeElement(),
    }] as T[]
  }

  function replaceTop(layer: T) {
    layers.value = [...layers.value.slice(0, -1), {
      ...layer,
      returnFocusTo: layer.returnFocusTo ?? top.value?.returnFocusTo ?? activeElement(),
    }] as T[]
  }

  function restore(layer?: T) {
    if (layer?.returnFocusTo?.isConnected) window.setTimeout(() => layer.returnFocusTo?.focus(), 0)
  }

  function pop() {
    const removed = top.value ?? undefined
    layers.value = layers.value.slice(0, -1)
    restore(removed)
    return removed
  }

  function popTo(key: string) {
    const index = layers.value.findIndex(layer => layer.key === key)
    if (index < 0) return
    layers.value = layers.value.slice(0, index + 1)
  }

  function clear() {
    const first = layers.value[0]
    layers.value = []
    restore(first)
  }

  const isTop = (key: string) => top.value?.key === key
  const isShifted = (key: string) => {
    const index = layers.value.findIndex(layer => layer.key === key)
    return index >= 0 && index < layers.value.length - 1
  }

  return { layers, top, push, replaceTop, pop, popTo, clear, isTop, isShifted }
}
```

- [ ] **Step 4: Verify and commit**

```bash
bun run test:unit -- tests/unit/composables/useSheetStack.spec.ts
bun run type-check
git add src/composables/useSheetStack.ts tests/unit/composables/useSheetStack.spec.ts
git commit -m "feat(ui): add semantic sheet stack controller"
```

Expected: both checks PASS and commit succeeds.

### Task 2: Make `PSheet` top-layer aware

**Files:**
- Modify: `src/components/ui/PSheet.vue`
- Modify: `src/components/ui/PSheetTab.vue`
- Modify: `tests/unit/system/PSheet.spec.ts`

- [ ] **Step 1: Add failing dialog and Escape tests**

```ts
it('exposes only the top layer as a modal dialog', () => {
  const wrapper = mount(PSheet, {
    props: { show: true, title: '专辑详情', isTopLayer: true, layerIndex: 2 },
  })
  const panel = wrapper.get('.p-sheet-panel')
  expect(panel.attributes('role')).toBe('dialog')
  expect(panel.attributes('aria-modal')).toBe('true')
  expect(panel.attributes('aria-label')).toBe('专辑详情')
  expect(panel.attributes('data-layer-index')).toBe('2')
})

it('only lets the top layer close with Escape', async () => {
  const top = mount(PSheet, { props: { show: true, isTopLayer: true } })
  const shifted = mount(PSheet, { props: { show: true, isTopLayer: false } })
  await top.get('.p-sheet-panel').trigger('keydown', { key: 'Escape' })
  await shifted.get('.p-sheet-panel').trigger('keydown', { key: 'Escape' })
  expect(top.emitted('close')).toHaveLength(1)
  expect(shifted.emitted('close')).toBeUndefined()
})

it('uses a labelled icon close control', () => {
  const wrapper = mount(PSheet, {
    props: { show: true, title: '历史记录', closeType: 'header' },
  })
  expect(wrapper.get('[aria-label="关闭历史记录"]')).toBeTruthy()
  expect(wrapper.text()).not.toContain('CLOSE')
})
```

- [ ] **Step 2: Run and verify failure**

```bash
bun run test:unit -- tests/unit/system/PSheet.spec.ts
```

Expected: FAIL because layer props and dialog semantics are absent.

- [ ] **Step 3: Implement the panel contract**

Add `isTopLayer?: boolean` and `layerIndex?: number`, defaulting to `true` and `0`. Update the panel root:

```vue
<div
  v-if="show"
  ref="panelRef"
  class="p-sheet-layer p-sheet-panel"
  :class="[`is-${side}`, { 'is-shifted': isShifted }]"
  :style="sheetStyle"
  role="dialog"
  :aria-modal="isTopLayer ? 'true' : undefined"
  :aria-label="title"
  :aria-hidden="isTopLayer ? undefined : 'true'"
  :inert="isTopLayer ? undefined : ''"
  :data-layer-index="layerIndex"
  tabindex="-1"
  @keydown.esc="isTopLayer && $emit('close')"
>
```

Focus the top layer:

```ts
const panelRef = ref<HTMLElement | null>(null)

watch(
  () => [props.show, props.isTopLayer] as const,
  async ([show, isTopLayer]) => {
    if (!show || !isTopLayer) return
    await nextTick()
    panelRef.value?.focus()
  },
  { immediate: true },
)
```

- [ ] **Step 4: Replace character close controls and add responsive rules**

```vue
<button
  v-if="showHeaderClose"
  class="header-close-btn"
  type="button"
  :aria-label="`关闭${title}`"
  :title="`关闭${title}`"
  @click="$emit('close')"
>
  <X :size="18" aria-hidden="true" />
</button>
```

Import `X` from `lucide-vue-next`; use the same icon in `PSheetTab.vue` with `:aria-label="`返回${title}`"`. Add:

```css
@media (max-width: 767px) {
  .p-sheet-layer {
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
  }
  .p-sheet-panel.is-shifted { visibility: hidden; }
}

@media (prefers-reduced-motion: reduce) {
  .p-sheet-panel,
  .slide-right-enter-active,
  .slide-right-leave-active,
  .slide-left-enter-active,
  .slide-left-leave-active,
  .slide-up-enter-active,
  .slide-up-leave-active { transition: none; }
}
```

- [ ] **Step 5: Verify and commit**

```bash
bun run test:unit -- tests/unit/system/PSheet.spec.ts
bun run type-check
git add src/components/ui/PSheet.vue src/components/ui/PSheetTab.vue tests/unit/system/PSheet.spec.ts
git commit -m "feat(ui): make sheets stack-aware and accessible"
```

Expected: PASS.

### Task 3: Back music drawer actions with semantic layers

**Files:**
- Create: `src/components/music/musicSheetTypes.ts`
- Modify: `src/composables/useMusicDrawers.ts`
- Modify: `tests/unit/composables/useMusicDrawers.spec.ts`

- [ ] **Step 1: Add the failing ordered-layer test**

```ts
it('keeps repeated entities and tasks as ordered layers', () => {
  const drawers = useMusicDrawers()
  drawers.openArtist('artist-1')
  drawers.openArtist('artist-2')
  drawers.openAlbum('album-3')
  drawers.openNestedAction('history', { albumId: 'album-3' })
  expect(drawers.layers.value.map(layer => layer.key)).toEqual([
    'artist:artist-1',
    'artist:artist-2',
    'album:album-3',
    'action:history:album-3',
  ])
})
```

- [ ] **Step 2: Run and verify failure**

```bash
bun run test:unit -- tests/unit/composables/useMusicDrawers.spec.ts
```

Expected: FAIL because repeated entity state is overwritten.

- [ ] **Step 3: Define the discriminated union**

```ts
import type { BaseSheetLayer } from '@/composables/useSheetStack'
import type { MusicCreationFlowStep } from '@/components/music/musicCreationTypes'

export type MusicEditorEntity = 'artist' | 'album'
export type MusicEditorMode = 'create' | 'edit'
export interface MusicEditorState {
  entity: MusicEditorEntity
  mode: MusicEditorMode
  id?: string
  seed?: Record<string, unknown>
}

export type MusicSheetLayer =
  | (BaseSheetLayer & { kind: 'artist'; payload: { artistId: string } })
  | (BaseSheetLayer & { kind: 'album'; payload: { albumId: string } })
  | (BaseSheetLayer & { kind: 'playlist'; payload: { playlistId: string } })
  | (BaseSheetLayer & { kind: 'action'; payload: { action: string; data: unknown } })
  | (BaseSheetLayer & { kind: 'editor'; payload: MusicEditorState })
  | (BaseSheetLayer & { kind: 'creation'; payload: {
      artistId?: string | null
      artistName?: string
      artistLegalName?: string
      startStep?: MusicCreationFlowStep
    } })
```

- [ ] **Step 4: Make open/close operations update the generic stack**

Move the existing `MusicEditorEntity`, `MusicEditorMode`, and `MusicEditorState` declarations out of `useMusicDrawers.ts` into `musicSheetTypes.ts`; import and re-export them from `useMusicDrawers.ts` to preserve consumers. At module scope, create `const sheetStack = createSheetStack<MusicSheetLayer>()`. Use stable entries:

```ts
const openArtist = (id: string) => {
  state.value.artistId = id
  sheetStack.push({
    key: `artist:${id}`,
    kind: 'artist',
    title: '艺术家详情',
    route: `/music/artist/${id}`,
    payload: { artistId: id },
  })
}

const openAlbum = (id: string) => {
  state.value.albumId = id
  sheetStack.push({
    key: `album:${id}`,
    kind: 'album',
    title: '专辑详情',
    route: `/music/album/${id}`,
    payload: { albumId: id },
  })
}

function closeLayerAndAbove(key: string) {
  sheetStack.popTo(key)
  sheetStack.pop()
}

const closeArtist = (key = sheetStack.top.value?.key ?? '') => closeLayerAndAbove(key)
const closeAlbum = (key = sheetStack.top.value?.key ?? '') => closeLayerAndAbove(key)

const openNestedAction = (action: Exclude<NestedActionType, null>, data: unknown = null) => {
  const ownerId = state.value.albumId ?? state.value.artistId ?? 'root'
  sheetStack.push({
    key: `action:${action}:${ownerId}`,
    kind: 'action',
    title: action === 'history' ? '历史记录' : '操作',
    payload: { action, data },
  })
}

const openMusicEditor = (editor: MusicEditorState) => {
  state.value.musicEditor = editor
  sheetStack.push({
    key: `editor:${editor.entity}:${editor.mode}:${editor.id ?? 'new'}`,
    kind: 'editor',
    title: editor.mode === 'create' ? '创建条目' : '修改条目',
    payload: editor,
  })
}

const openMusicCreationFlow = (seed: MusicCreationFlowSeed = {}) => {
  state.value.creationFlow = {
    step: seed.startStep ?? 'artist',
    draft: createEmptyDraft(seed),
    tracksCustomized: false,
    titleCustomized: false,
    dirty: false,
    submitting: false,
    errorMessage: '',
  }
  sheetStack.push({
    key: `creation:${seed.artistId ?? 'new'}`,
    kind: 'creation',
    title: '创建音乐条目',
    payload: seed,
  })
}

watch(sheetStack.layers, (layers) => {
  const reversed = [...layers].reverse()
  const artist = reversed.find(layer => layer.kind === 'artist')
  const album = reversed.find(layer => layer.kind === 'album')
  state.value.artistId = artist?.kind === 'artist' ? artist.payload.artistId : null
  state.value.albumId = album?.kind === 'album' ? album.payload.albumId : null
})
```

Add `watch` to the Vue imports and add `startStep?: MusicCreationFlowStep` to the existing `MusicCreationFlowSeed` type before using this code.

Return `layers`, `topLayer`, `popLayer`, `popToLayer`, `isTopLayer`, and `isLayerShifted`. Keep existing state fields temporarily for compatibility; derive shifted flags from the ordered layers. `closeAll()` resets legacy draft state and calls `sheetStack.clear()`.

- [ ] **Step 5: Verify and commit**

```bash
bun run test:unit -- tests/unit/composables/useSheetStack.spec.ts tests/unit/composables/useMusicDrawers.spec.ts
bun run type-check
git add src/components/music/musicSheetTypes.ts src/composables/useMusicDrawers.ts tests/unit/composables/useMusicDrawers.spec.ts
git commit -m "refactor(music): back drawers with semantic layers"
```

Expected: PASS.

### Task 4: Render one music component instance per layer

**Files:**
- Create: `src/components/music/MusicSheetStack.vue`
- Create: `tests/unit/components/music/MusicSheetStack.spec.ts`
- Modify: `src/views/music/MusicLayout.vue`, `HomeView.vue`, `ArtistsView.vue`, `StarredView.vue`
- Modify: `src/components/music/ArtistDrawer.vue`, `AlbumDrawer.vue`, `PlaylistDrawer.vue`

- [ ] **Step 1: Write the failing renderer test**

```ts
it('renders repeated entity kinds as separate ordered layers', () => {
  const drawers = useMusicDrawers()
  drawers.openArtist('artist-1')
  drawers.openArtist('artist-2')
  drawers.openAlbum('album-3')
  const wrapper = mount(MusicSheetStack, {
    global: { stubs: {
      ArtistDrawer: { props: ['layer'], template: '<div class="artist-layer">{{ layer.key }}</div>' },
      AlbumDrawer: { props: ['layer'], template: '<div class="album-layer">{{ layer.key }}</div>' },
      PlaylistDrawer: true,
      MusicEntityEditorDrawer: true,
      MusicCreationFlowDrawer: true,
      NestedActionDrawer: true,
      MusicMergeDrawer: true,
    } },
  })
  expect(wrapper.findAll('.artist-layer').map(node => node.text())).toEqual([
    'artist:artist-1', 'artist:artist-2',
  ])
  expect(wrapper.get('.album-layer').text()).toBe('album:album-3')
})
```

- [ ] **Step 2: Run and verify failure**

```bash
bun run test:unit -- tests/unit/components/music/MusicSheetStack.spec.ts
```

Expected: FAIL because the renderer does not exist.

- [ ] **Step 3: Implement the renderer**

```vue
<script setup lang="ts">
import ArtistDrawer from './ArtistDrawer.vue'
import AlbumDrawer from './AlbumDrawer.vue'
import PlaylistDrawer from './PlaylistDrawer.vue'
import MusicEntityEditorDrawer from './MusicEntityEditorDrawer.vue'
import MusicCreationFlowDrawer from './MusicCreationFlowDrawer.vue'
import NestedActionDrawer from './NestedActionDrawer.vue'
import MusicMergeDrawer from './MusicMergeDrawer.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
const { layers } = useMusicDrawers()
</script>

<template>
  <template v-for="(layer, index) in layers" :key="layer.key">
    <ArtistDrawer v-if="layer.kind === 'artist'" :layer="layer" :layer-index="index" />
    <AlbumDrawer v-else-if="layer.kind === 'album'" :layer="layer" :layer-index="index" />
    <PlaylistDrawer v-else-if="layer.kind === 'playlist'" :layer="layer" :layer-index="index" />
    <MusicMergeDrawer
      v-else-if="layer.kind === 'action' && (layer.payload.action === 'merge_artist' || layer.payload.action === 'merge_album')"
      :layer="layer"
      :layer-index="index"
    />
    <NestedActionDrawer v-else-if="layer.kind === 'action'" :layer="layer" :layer-index="index" />
    <MusicEntityEditorDrawer v-else-if="layer.kind === 'editor'" :layer="layer" :layer-index="index" />
    <MusicCreationFlowDrawer v-else :layer="layer" :layer-index="index" />
  </template>
</template>
```

Mount it once in `MusicLayout.vue`; remove duplicate drawer mounts from the three routed views.

- [ ] **Step 4: Convert entity drawers to explicit IDs**

Example for `ArtistDrawer.vue`:

```ts
type ArtistLayer = Extract<MusicSheetLayer, { kind: 'artist' }>
const props = defineProps<{ layer: ArtistLayer; layerIndex: number }>()
const artistId = computed(() => props.layer.payload.artistId)
const { closeArtist, isLayerShifted, isTopLayer } = useMusicDrawers()
```

Bind each drawer:

```vue
<PSheet
  :show="true"
  :title="layer.title"
  :layer-index="layerIndex"
  :is-top-layer="isTopLayer(layer.key)"
  :is-shifted="isLayerShifted(layer.key)"
  width="900px"
  @close="closeArtist(layer.key)"
>
```

Apply the same payload pattern to album and playlist drawers. Replace all reads of singleton entity IDs with the explicit payload ID so shifted instances retain their own fetched data.

- [ ] **Step 5: Verify and commit**

```bash
bun run test:unit -- tests/unit/components/music/MusicSheetStack.spec.ts tests/unit/components/music/ArtistDrawer.spec.ts tests/unit/components/music/AlbumDrawer.spec.ts tests/unit/components/music/PlaylistDrawer.spec.ts tests/unit/views/music/MusicLayout.spec.ts
bun run type-check
git add src/components/music/MusicSheetStack.vue src/views/music/MusicLayout.vue src/views/music/HomeView.vue src/views/music/ArtistsView.vue src/views/music/StarredView.vue src/components/music/ArtistDrawer.vue src/components/music/AlbumDrawer.vue src/components/music/PlaylistDrawer.vue tests/unit/components/music/MusicSheetStack.spec.ts
git commit -m "refactor(music): render drawers from semantic stack"
```

Expected: PASS.

### Task 5: Preserve task-layer form and error state

**Files:**
- Modify: `src/components/music/MusicCreationFlowDrawer.vue`
- Modify: `src/components/music/MusicEntityEditorDrawer.vue`
- Modify: `src/components/music/NestedActionDrawer.vue`
- Modify: `src/components/music/MusicMergeDrawer.vue`
- Modify: corresponding tests in `tests/unit/components/music/`

- [ ] **Step 1: Add a failing preservation test**

```ts
it('keeps a revision draft mounted beneath history', async () => {
  const drawers = useMusicDrawers()
  drawers.openAlbum('album-1')
  drawers.openNestedAction('revise', { albumId: 'album-1' })
  const reviseLayer = drawers.topLayer.value!
  const wrapper = mount(NestedActionDrawer, {
    props: { layer: reviseLayer, layerIndex: 1 },
  })
  await wrapper.get('textarea').setValue('保留这段修订说明')
  drawers.openNestedAction('history', { albumId: 'album-1' })
  expect(wrapper.get('textarea').element.value).toBe('保留这段修订说明')
  expect(wrapper.findComponent({ name: 'PSheet' }).props('isShifted')).toBe(true)
})
```

- [ ] **Step 2: Run and verify failure**

```bash
bun run test:unit -- tests/unit/components/music/NestedActionDrawer.spec.ts
```

Expected: FAIL because task drawers still consume singleton action state.

- [ ] **Step 3: Apply explicit task-layer props**

```ts
type ActionLayer = Extract<MusicSheetLayer, { kind: 'action' }>
const props = defineProps<{ layer: ActionLayer; layerIndex: number }>()
const action = computed(() => props.layer.payload.action)
const payload = computed(() => props.layer.payload.data)
```

Use the same `layer`, `layerIndex`, `isTopLayer`, and `isLayerShifted` binding in all four task drawers, including `MusicMergeDrawer.vue`. The merge drawer derives its entity and source ID from `layer.payload` rather than singleton drawer fields. Keep input refs, dirty flags, current wizard step, selected merge target, and error messages inside each mounted component instance. Wizard step changes update local state and never push another layer.

- [ ] **Step 4: Verify and commit**

```bash
bun run test:unit -- tests/unit/components/music/NestedActionDrawer.spec.ts tests/unit/components/music/MusicMergeDrawer.spec.ts tests/unit/components/music/MusicEntityEditorDrawer.spec.ts tests/unit/components/music/MusicCreationFlowDrawer.spec.ts tests/unit/components/music/MusicCreationArtistStep.spec.ts tests/unit/components/music/MusicCreationAlbumDetailsStep.spec.ts
bun run type-check
git add src/components/music/MusicCreationFlowDrawer.vue src/components/music/MusicEntityEditorDrawer.vue src/components/music/NestedActionDrawer.vue src/components/music/MusicMergeDrawer.vue tests/unit/components/music
git commit -m "refactor(music): preserve task layers in sheet stack"
```

Expected: PASS.

### Task 6: Synchronize top entity layers with route history

**Files:**
- Create: `src/composables/useMusicSheetRouteSync.ts`
- Modify: `src/views/music/MusicLayout.vue`
- Modify: `src/views/music/MusicArtistRouteView.vue`, `MusicAlbumRouteView.vue`, `MusicPlaylistRouteView.vue`
- Modify: `tests/unit/views/music/MusicDetailRouteViews.spec.ts`

- [ ] **Step 1: Write the failing browser-back test**

```ts
it('pops to the artist layer when history returns from an album', async () => {
  const router = createRouter({ history: createMemoryHistory(), routes: buildAppRoutes() })
  const drawers = useMusicDrawers()
  await router.push('/music/artist/artist-1')
  drawers.openArtist('artist-1')
  drawers.openAlbum('album-2')
  await router.push('/music/album/album-2')
  router.back()
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/music/artist/artist-1')
  expect(drawers.layers.value.map(layer => layer.key)).toEqual(['artist:artist-1'])
})
```

- [ ] **Step 2: Run and verify failure**

```bash
bun run test:unit -- tests/unit/views/music/MusicDetailRouteViews.spec.ts
```

Expected: FAIL because route shells clear all layers on unmount.

- [ ] **Step 3: Implement the route adapter**

```ts
import { watch } from 'vue'
import type { Router } from 'vue-router'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

export function useMusicSheetRouteSync(router: Router) {
  const drawers = useMusicDrawers()
  watch(drawers.topLayer, async (layer) => {
    if (layer?.route && layer.route !== router.currentRoute.value.path) {
      await router.push(layer.route)
    }
  })

  function syncEntityRoute(key: string, open: () => void) {
    if (drawers.layers.value.some(layer => layer.key === key)) {
      drawers.popToLayer(key)
    } else {
      open()
    }
  }

  return { syncEntityRoute }
}
```

Initialize the adapter once in `MusicLayout.vue`. Route shells call `syncEntityRoute()` from their parameter watcher and remove `onBeforeUnmount(closeAll)`. When the current route equals the top layer route, close actions call `router.back()`; otherwise they call `popLayer()`.

- [ ] **Step 4: Verify and commit**

```bash
bun run test:unit -- tests/unit/views/music/MusicDetailRouteViews.spec.ts tests/unit/router/musicRoutes.spec.ts tests/unit/composables/useMusicDrawers.spec.ts tests/unit/composables/useSheetStack.spec.ts
bun run type-check
git add src/composables/useMusicSheetRouteSync.ts src/views/music/MusicLayout.vue src/views/music/MusicArtistRouteView.vue src/views/music/MusicAlbumRouteView.vue src/views/music/MusicPlaylistRouteView.vue tests/unit/views/music/MusicDetailRouteViews.spec.ts
git commit -m "feat(music): sync sheet layers with route history"
```

Expected: PASS.

### Task 7: Verify stacking as an independent deliverable

**Files:**
- No source changes expected.

- [ ] **Step 1: Run complete checks**

```bash
bun run type-check
bun run test:unit
bun run build
```

Expected: all commands exit `0`.

- [ ] **Step 2: Start and verify the approved development server**

```bash
~/.claude/skills/brainstorming/scripts/start-server.sh \
  --project-dir /Users/fafa/projects/Atoman/Atoman-Frontend \
  --host 0.0.0.0 \
  --url-host localhost \
  --foreground
```

After the server prints its startup JSON, use another shell call:

```bash
SESSION_DIR="$(ls -td .superpowers/brainstorm/*/ | head -n 1)"
URL="$(sed -n 's/.*"url":"\([^"]*\)".*/\1/p' "$SESSION_DIR/state/server-info")"
curl -s -o /dev/null -w '%{http_code}\n' "$URL/"
```

Expected: `200`.

- [ ] **Step 3: Verify desktop and mobile flows**

Desktop: open artist → album → revise → history; confirm four mounted layers, lower-layer return, one-layer browser Back, focus restoration, retained errors/drafts, and uninterrupted player. Mobile at `390x844`: confirm only the top layer is visible and Back exits one layer. With reduced motion enabled, confirm slide/shift transitions are disabled.

- [ ] **Step 4: Stop the server and verify clean Git state**

```bash
SESSION_DIR="$(ls -td .superpowers/brainstorm/*/ | head -n 1)"
~/.claude/skills/brainstorming/scripts/stop-server.sh "$SESSION_DIR"
git status --short
```

Expected: stopped server and no Git output.
