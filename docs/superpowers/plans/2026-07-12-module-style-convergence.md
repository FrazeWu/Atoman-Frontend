# Module Style Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved design rules to video and music modules, including the four-item video navigation, functional watch-later actions, always-visible statistics, 4px geometry, Lucide icons, flat surfaces, and 500-weight headings.

**Architecture:** Video bookmark API calls live in a focused composable shared by all video cards. `PVideoCard` owns the card-level bookmark interaction and guest login redirect, while bookmark data and network state remain outside its rendering code. Navigation changes stay in route/sidebar configuration, while module CSS cleanup is guarded by targeted source-contract tests rather than a risky all-repository rewrite.

**Tech Stack:** Vue 3, TypeScript, Pinia auth store, Vue Router 4, Lucide Vue, Vitest, Vue Test Utils, Bun

---

## File Map

- Modify `src/composables/useApi.ts`: expose video bookmark endpoints.
- Create `src/composables/useVideoBookmarks.ts`: bookmark loading/toggling state.
- Create `tests/unit/composables/useVideoBookmarks.spec.ts`: API and optimistic-state tests.
- Modify `src/components/shared/PVideoCard.vue` and its test: valid interactive structure and approved presentation.
- Modify `src/views/video/VideoLayout.vue`: load bookmark state for authenticated sessions.
- Modify `src/router/routes/modules.ts`, `src/components/system/AppSidebar.vue`, and route/sidebar tests: four-item video navigation.
- Modify `src/views/video/VideoEditorView.vue`, `VideoDetailView.vue`, `VideoManageView.vue`, `VideoHomeView.vue`, `VideoSubscriptionsView.vue`, `VideoFavoritesView.vue`: video visual convergence.
- Modify `src/views/music/ArtistsView.vue`, `ExploreView.vue`, `StarredView.vue`, and selected music drawers: music visual convergence.
- Create `tests/unit/ui/module-style-contract.spec.ts`: scoped no-regression checks.

### Task 1: Add tested video bookmark state

**Files:**
- Modify: `src/composables/useApi.ts:225-235`
- Create: `src/composables/useVideoBookmarks.ts`
- Create: `tests/unit/composables/useVideoBookmarks.spec.ts`

- [ ] **Step 1: Write failing bookmark tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useVideoBookmarks } from '@/composables/useVideoBookmarks'

const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data, message: 'ok' }), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

describe('useVideoBookmarks', () => {
  beforeEach(() => {
    useVideoBookmarks().reset()
    vi.restoreAllMocks()
  })

  it('indexes loaded bookmarks by video id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([
      { id: 'bookmark-1', video_id: 'video-1' },
    ])))
    const bookmarks = useVideoBookmarks()
    await bookmarks.load()
    expect(bookmarks.isBookmarked('video-1')).toBe(true)
    expect(bookmarks.bookmarkId('video-1')).toBe('bookmark-1')
  })

  it('creates and deletes a bookmark through the backend contract', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ id: 'bookmark-2', video_id: 'video-2' }, 201))
      .mockResolvedValueOnce(response(null))
    vi.stubGlobal('fetch', fetchMock)
    const bookmarks = useVideoBookmarks()
    await bookmarks.toggle('video-2')
    expect(bookmarks.isBookmarked('video-2')).toBe(true)
    await bookmarks.toggle('video-2')
    expect(bookmarks.isBookmarked('video-2')).toBe(false)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' })
    expect(fetchMock.mock.calls[1][0]).toContain('/videos/bookmarks/bookmark-2')
  })

  it('restores previous state when a toggle fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const bookmarks = useVideoBookmarks()
    await expect(bookmarks.toggle('video-3')).rejects.toThrow('network')
    expect(bookmarks.isBookmarked('video-3')).toBe(false)
    expect(bookmarks.errorMessage.value).toBe('稍后再试')
  })
})
```

- [ ] **Step 2: Run and verify failure**

```bash
bun run test:unit -- tests/unit/composables/useVideoBookmarks.spec.ts
```

Expected: FAIL because the composable does not exist.

- [ ] **Step 3: Expose bookmark endpoints**

Add to `useApi().videos` without removing current auth, onboarding, or admin endpoint additions elsewhere in the returned object:

```ts
bookmarks: `${apiUrl}/videos/bookmarks`,
bookmark: (id: string) => `${apiUrl}/videos/bookmarks/${id}`,
```

- [ ] **Step 4: Implement the composable**

```ts
import { computed, ref } from 'vue'
import { apiDeleteJson, apiGet, apiPostJson } from '@/api/client'
import { useApi } from '@/composables/useApi'

type VideoBookmark = { id: string; video_id: string }

const records = ref<Record<string, VideoBookmark>>({})
const loading = ref(false)
const pendingIds = ref(new Set<string>())
const errorMessage = ref('')

export function useVideoBookmarks() {
  const endpoints = useApi().videos
  const bookmarkedIds = computed(() => new Set(Object.keys(records.value)))
  const isBookmarked = (videoId: string) => bookmarkedIds.value.has(videoId)
  const bookmarkId = (videoId: string) => records.value[videoId]?.id ?? null
  const isPending = (videoId: string) => pendingIds.value.has(videoId)

  async function load() {
    loading.value = true
    errorMessage.value = ''
    try {
      const items = await apiGet<VideoBookmark[]>(endpoints.bookmarks)
      records.value = Object.fromEntries(items.map(item => [String(item.video_id), item]))
    } finally {
      loading.value = false
    }
  }

  async function toggle(videoId: string) {
    if (isPending(videoId)) return
    pendingIds.value = new Set([...pendingIds.value, videoId])
    errorMessage.value = ''
    const existing = records.value[videoId]
    try {
      if (existing) {
        await apiDeleteJson(endpoints.bookmark(existing.id))
        const next = { ...records.value }
        delete next[videoId]
        records.value = next
      } else {
        const created = await apiPostJson<VideoBookmark>(endpoints.bookmarks, { video_id: videoId })
        records.value = { ...records.value, [videoId]: created }
      }
    } catch (error) {
      errorMessage.value = '稍后再试'
      throw error
    } finally {
      const next = new Set(pendingIds.value)
      next.delete(videoId)
      pendingIds.value = next
    }
  }

  function reset() {
    records.value = {}
    pendingIds.value = new Set()
    errorMessage.value = ''
  }

  return { records, loading, errorMessage, isBookmarked, bookmarkId, isPending, load, toggle, reset }
}
```

- [ ] **Step 5: Verify and commit**

```bash
bun run test:unit -- tests/unit/composables/useVideoBookmarks.spec.ts
bun run type-check
git add src/composables/useApi.ts src/composables/useVideoBookmarks.ts tests/unit/composables/useVideoBookmarks.spec.ts
git commit -m "feat(video): add shared bookmark state"
```

Expected: PASS.

### Task 2: Make `PVideoCard` accessible and functional

**Files:**
- Modify: `src/components/shared/PVideoCard.vue`
- Modify: `tests/unit/components/shared/PVideoCard.spec.ts`
- Modify: `src/views/video/VideoLayout.vue`

- [ ] **Step 1: Replace the obsolete non-clickable test**

Add `vi` and `beforeEach` to the existing Vitest import, then use this setup and these tests:

```ts
const cardMocks = vi.hoisted(() => ({
  authenticated: true,
  toggle: vi.fn(),
  isBookmarked: vi.fn(() => false),
  isPending: vi.fn(() => false),
  push: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ get isAuthenticated() { return cardMocks.authenticated } }),
}))

vi.mock('@/composables/useVideoBookmarks', () => ({
  useVideoBookmarks: () => ({
    toggle: cardMocks.toggle,
    isBookmarked: cardMocks.isBookmarked,
    isPending: cardMocks.isPending,
  }),
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: cardMocks.push }) }
})

function mountCard() {
  return mount(PVideoCard, {
    props: {
      video: {
        id: 'video-1',
        title: 'Video Title',
        thumbnail_url: '',
        view_count: 12,
        duration_sec: 90,
        created_at: '2026-01-02T00:00:00Z',
      },
    },
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

beforeEach(() => {
  cardMocks.authenticated = true
  cardMocks.toggle.mockReset()
  cardMocks.push.mockReset()
  cardMocks.isBookmarked.mockReturnValue(false)
  cardMocks.isPending.mockReturnValue(false)
})

it('renders persistent statistics and a labelled watch-later button', () => {
  const wrapper = mountCard()
  expect(wrapper.text()).toContain('12')
  expect(wrapper.text()).toContain('1:30')
  expect(wrapper.get('button[aria-label="稍后看 Video Title"]')).toBeTruthy()
  expect(wrapper.get('.vc-thumb').classes()).toContain('vc-thumb')
})

it('does not nest the watch-later button inside a link', () => {
  const wrapper = mountCard()
  expect(wrapper.find('a button').exists()).toBe(false)
})

it('toggles for members and routes guests to login', async () => {
  const memberCard = mountCard()
  await memberCard.get('.vc-watch-later').trigger('click')
  expect(cardMocks.toggle).toHaveBeenCalledWith('video-1')

  cardMocks.authenticated = false
  const guestCard = mountCard()
  await guestCard.get('.vc-watch-later').trigger('click')
  expect(cardMocks.push).toHaveBeenCalledWith('/login')
})
```

- [ ] **Step 2: Run and verify failure**

```bash
bun run test:unit -- tests/unit/components/shared/PVideoCard.spec.ts
```

Expected: FAIL because watch-later is a `span` nested in the card link.

- [ ] **Step 3: Split navigation and action markup**

Use this structure:

```vue
<article class="vc-card">
  <div class="vc-thumb">
    <RouterLink :to="to || `/videos/watch/${video.id}`" class="vc-thumb-link" :aria-label="video.title">
      <img v-if="video.thumbnail_url" :src="video.thumbnail_url" :alt="video.title" class="vc-img" loading="lazy" />
      <div v-else class="vc-thumb-placeholder"><Play :size="28" aria-hidden="true" /></div>
      <span class="vc-play-count"><Play :size="12" aria-hidden="true" />{{ fmtViews(video.view_count) }}</span>
      <span v-if="video.duration_sec" class="vc-duration">{{ fmtDuration(video.duration_sec) }}</span>
    </RouterLink>
    <button
      type="button"
      class="vc-watch-later"
      :class="{ 'is-active': bookmarks.isBookmarked(String(video.id)) }"
      :disabled="bookmarks.isPending(String(video.id))"
      :aria-label="`${bookmarks.isBookmarked(String(video.id)) ? '取消稍后看' : '稍后看'} ${video.title}`"
      :title="bookmarks.isBookmarked(String(video.id)) ? '取消稍后看' : '稍后看'"
      @click="toggleWatchLater"
    >
      <Clock3 :size="18" aria-hidden="true" />
    </button>
  </div>
  <RouterLink :to="to || `/videos/watch/${video.id}`" class="vc-info">
    <div class="vc-avatar" aria-hidden="true">
      <img v-if="video.channel?.cover_url" :src="video.channel.cover_url" :alt="video.channel.name" />
      <span v-else>{{ avatarLetter() }}</span>
    </div>
    <div class="vc-text">
      <h3 class="vc-title a-clamp-2">{{ video.title }}</h3>
      <div class="vc-meta">
        <span v-if="video.channel" class="vc-channel">《{{ video.channel.name }}》</span>
        <div class="vc-stats"><span>{{ fmtDate(video.created_at) }}</span></div>
      </div>
    </div>
  </RouterLink>
</article>
```

Use `Play` and `Clock3` from `lucide-vue-next` and add:

```ts
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useVideoBookmarks } from '@/composables/useVideoBookmarks'

const router = useRouter()
const authStore = useAuthStore()
const bookmarks = useVideoBookmarks()

async function toggleWatchLater() {
  if (!authStore.isAuthenticated) {
    await router.push('/login')
    return
  }
  await bookmarks.toggle(String(props.video.id))
}
```

- [ ] **Step 4: Apply the approved card styles**

```css
.vc-thumb { border-radius: 4px; box-shadow: none; }
.vc-avatar { border-radius: 4px; font-weight: 500; }
.vc-title, .vc-channel { font-weight: 500; letter-spacing: 0; }
.vc-card:hover .vc-title,
.vc-card:focus-within .vc-title { text-decoration: underline; text-decoration-thickness: 1px; }
.vc-watch-later {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  opacity: 0;
  border: 1px solid var(--a-color-line);
  border-radius: 4px;
  background: var(--a-color-paper);
  box-shadow: none;
}
.vc-card:hover .vc-watch-later,
.vc-card:focus-within .vc-watch-later { opacity: 1; }
@media (hover: none) { .vc-watch-later { opacity: 1; } }
```

In `VideoLayout.vue`, synchronize bookmark state with the session:

```ts
const authStore = useAuthStore()
const bookmarks = useVideoBookmarks()

watch(
  () => authStore.isAuthenticated,
  (authenticated) => {
    if (authenticated) void bookmarks.load()
    else bookmarks.reset()
  },
  { immediate: true },
)
```

- [ ] **Step 5: Verify and commit**

```bash
bun run test:unit -- tests/unit/components/shared/PVideoCard.spec.ts tests/unit/composables/useVideoBookmarks.spec.ts tests/unit/views/video/VideoLayout.spec.ts
bun run type-check
git add src/components/shared/PVideoCard.vue src/views/video/VideoLayout.vue tests/unit/components/shared/PVideoCard.spec.ts
git commit -m "feat(video): make watch-later cards accessible"
```

Expected: PASS.

### Task 3: Adopt the four-item video navigation

**Files:**
- Modify: `src/router/routes/modules.ts`
- Modify: `src/components/system/AppSidebar.vue`
- Modify: `src/views/video/VideoLayout.vue`
- Modify: `tests/unit/router/routes.spec.ts`
- Modify: `tests/unit/views/video/VideoLayout.spec.ts`

- [ ] **Step 1: Write failing route and sidebar assertions**

```ts
it('registers the approved video destinations', () => {
  const root = moduleRoutes.video.find(route => route.path === '/')
  const paths = root?.children?.map(route => route.path)
  expect(paths).toEqual(expect.arrayContaining(['', 'subscriptions', 'favorites', 'creator']))
  expect(root?.children?.find(route => route.path === 'manage')?.redirect).toBe('/videos/creator')
})
```

Update `VideoLayout.spec.ts`:

```ts
expect(sidebarSource).toContain('to="/videos"')
expect(sidebarSource).toContain('to="/videos/subscriptions"')
expect(sidebarSource).toContain('to="/videos/favorites"')
expect(sidebarSource).toContain('to="/videos/creator"')
```

- [ ] **Step 2: Run and verify failure**

```bash
bun run test:unit -- tests/unit/router/routes.spec.ts tests/unit/views/video/VideoLayout.spec.ts
```

Expected: FAIL because favorites is absent and creator still uses `/manage`.

- [ ] **Step 3: Add routes and sidebar items**

Use these video children:

```ts
{ path: '', component: () => import('@/views/video/VideoHomeView.vue') },
{ path: 'subscriptions', component: () => import('@/views/video/VideoSubscriptionsView.vue'), meta: { requiresAuth: true } },
{ path: 'favorites', component: () => import('@/views/video/VideoFavoritesView.vue'), meta: { requiresAuth: true } },
{ path: 'creator', component: () => import('@/views/video/VideoManageView.vue'), meta: { requiresAuth: true, featureGate: { module: 'video', feature: 'video.publish' } } },
{ path: 'manage', redirect: '/videos/creator' },
```

Use `Bookmark` for 收藏 and `Settings` for 创作 in `AppSidebar.vue`, with indices 1-4. Update the compliance tags in `VideoLayout.vue` to the same four paths.

- [ ] **Step 4: Verify and commit**

```bash
bun run test:unit -- tests/unit/router/routes.spec.ts tests/unit/views/video/VideoLayout.spec.ts
bun run type-check
git add src/router/routes/modules.ts src/components/system/AppSidebar.vue src/views/video/VideoLayout.vue tests/unit/router/routes.spec.ts tests/unit/views/video/VideoLayout.spec.ts
git commit -m "feat(video): adopt four-item module navigation"
```

Expected: PASS.

### Task 4: Converge video module styling

**Files:**
- Create: `tests/unit/ui/module-style-contract.spec.ts`
- Modify: video views under `src/views/video/`
- Modify: `src/components/shared/PVideoPlayerShell.vue`

- [ ] **Step 1: Write the failing scoped contract**

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const videoFiles = [
  'src/views/video/VideoEditorView.vue',
  'src/views/video/VideoDetailView.vue',
  'src/views/video/VideoManageView.vue',
  'src/views/video/VideoHomeView.vue',
  'src/views/video/VideoSubscriptionsView.vue',
  'src/views/video/VideoFavoritesView.vue',
  'src/components/shared/PVideoPlayerShell.vue',
]

describe('module style contract', () => {
  it('keeps video surfaces flat, 4px, and headings at 500', () => {
    for (const path of videoFiles) {
      const source = read(path)
      expect(source, path).not.toMatch(/font-weight:\s*(700|800|900|950)/)
      expect(source, path).not.toMatch(/border-radius:\s*(8px|10px|12px|16px)/)
      expect(source, path).not.toMatch(/box-shadow:\s*(?:[1-9]|0\s+[1-9]|0\s+0\s+[1-9])/)
    }
  })
})
```

- [ ] **Step 2: Run and verify failure**

```bash
bun run test:unit -- tests/unit/ui/module-style-contract.spec.ts
```

Expected: FAIL on current 8px radii and 700-900 weights.

- [ ] **Step 3: Apply mechanical visual replacements**

In the listed files only:

```css
border-radius: 4px;
font-weight: 500;
letter-spacing: 0;
box-shadow: none;
```

Keep `border-radius: 50%` only for radio controls and status dots, not avatars or media. Replace inline `font-weight:900` in `VideoManageView.vue` with classes using `500`. Do not change fetch logic, form fields, video playback, or responsive grid behavior.

- [ ] **Step 4: Verify and commit**

```bash
bun run test:unit -- tests/unit/ui/module-style-contract.spec.ts tests/unit/views/video tests/unit/components/VideoPlayerControls.spec.ts
bun run type-check
git add src/views/video src/components/shared/PVideoPlayerShell.vue tests/unit/ui/module-style-contract.spec.ts
git commit -m "style(video): converge on global visual rules"
```

Expected: PASS.

### Task 5: Converge music module styling and icons

**Files:**
- Modify: `tests/unit/ui/module-style-contract.spec.ts`
- Modify: `src/views/music/ArtistsView.vue`, `ExploreView.vue`, `StarredView.vue`
- Modify: `src/components/music/ArtistDrawer.vue`, `AlbumDrawer.vue`, `PlaylistDrawer.vue`, `NestedActionDrawer.vue`

- [ ] **Step 1: Extend the failing contract to music files**

```ts
const musicFiles = [
  'src/views/music/ArtistsView.vue',
  'src/views/music/ExploreView.vue',
  'src/views/music/StarredView.vue',
  'src/components/music/ArtistDrawer.vue',
  'src/components/music/AlbumDrawer.vue',
  'src/components/music/PlaylistDrawer.vue',
  'src/components/music/NestedActionDrawer.vue',
]

it('keeps music surfaces flat, 4px, and free of hand-drawn icons', () => {
  for (const path of musicFiles) {
    const source = read(path)
    expect(source, path).not.toMatch(/font-weight:\s*(700|800|900|950)/)
    expect(source, path).not.toMatch(/border-radius:\s*(8px|10px|12px|16px|999px)/)
    expect(source, path).not.toMatch(/box-shadow:\s*(?:[1-9]|0\s+[1-9]|0\s+0\s+[1-9])/)
    expect(source, path).not.toContain('<svg')
  }
})
```

- [ ] **Step 2: Run and verify failure**

```bash
bun run test:unit -- tests/unit/ui/module-style-contract.spec.ts
```

Expected: FAIL on heavy weights, shadows, pill radii, and manual SVG placeholders.

- [ ] **Step 3: Apply approved music rules**

Use `500`, `4px`, zero letter spacing, and no shadows in the listed files. Replace manual person SVGs in `ArtistDrawer.vue` with `UserRound` from `lucide-vue-next`; keep `Play`, `Heart`, `Plus`, `Disc`, and `Music` imports already used by music components. Primary buttons remain global blue; success/play progress remains green; destructive actions use red; warnings use orange.

Replacement markup:

```vue
<div v-else class="artist-header-avatar-placeholder">
  <UserRound :size="32" aria-hidden="true" />
</div>
```

- [ ] **Step 4: Verify and commit**

```bash
bun run test:unit -- tests/unit/ui/module-style-contract.spec.ts tests/unit/views/music tests/unit/components/music
bun run type-check
git add src/views/music/ArtistsView.vue src/views/music/ExploreView.vue src/views/music/StarredView.vue src/components/music/ArtistDrawer.vue src/components/music/AlbumDrawer.vue src/components/music/PlaylistDrawer.vue src/components/music/NestedActionDrawer.vue tests/unit/ui/module-style-contract.spec.ts
git commit -m "style(music): converge on global visual rules"
```

Expected: PASS.

### Task 6: Converge the application shell, shared interaction UI, and settings

**Files:**
- Modify: `tests/unit/ui/module-style-contract.spec.ts`
- Modify: `src/style.css`
- Modify: `src/components/system/AppSidebar.vue`, `AppTopbar.vue`, `AppTopbarAuthControls.vue`, `MobileBottomNav.vue`, `MobileMoreSheet.vue`, `TopbarSearchSection.vue`
- Modify: `src/components/shared/CommentThread.vue`, `InteractionBar.vue`, `PEditorRuntime.vue`
- Modify: `src/components/setting/SettingFeedSourcePanel.vue`
- Modify: `src/views/setting/SettingAccessView.vue`, `SettingLayout.vue`, `SettingMusicReview.vue`

- [ ] **Step 1: Add the failing shell contract**

```ts
const shellFiles = [
  'src/style.css',
  'src/components/system/AppSidebar.vue',
  'src/components/system/AppTopbar.vue',
  'src/components/system/AppTopbarAuthControls.vue',
  'src/components/system/MobileBottomNav.vue',
  'src/components/system/MobileMoreSheet.vue',
  'src/components/system/TopbarSearchSection.vue',
  'src/components/shared/CommentThread.vue',
  'src/components/shared/InteractionBar.vue',
  'src/components/shared/PEditorRuntime.vue',
  'src/components/setting/SettingFeedSourcePanel.vue',
  'src/views/setting/SettingAccessView.vue',
  'src/views/setting/SettingLayout.vue',
  'src/views/setting/SettingMusicReview.vue',
]

it('keeps shell and settings title surfaces on the global contract', () => {
  for (const path of shellFiles) {
    const source = read(path)
    expect(source, path).not.toMatch(/font-weight:\s*(700|800|900|950)/)
    expect(source, path).not.toMatch(/border-radius:\s*(8px|10px|12px|16px|20px|24px|999px)/)
    expect(source, path).not.toMatch(/box-shadow:\s*(?:[1-9]|0\s+[1-9]|0\s+0\s+[1-9])/)
  }
})
```

- [ ] **Step 2: Run and verify failure**

```bash
bun run test:unit -- tests/unit/ui/module-style-contract.spec.ts
```

Expected: FAIL on current shell/settings heavy weights, pill radii, and editor shadows.

- [ ] **Step 3: Apply scoped replacements**

Replace only visual declarations in the listed files:

```css
font-weight: 500;
letter-spacing: 0;
border-radius: 4px;
box-shadow: none;
```

Preserve `50%` for radio controls and status dots. Do not alter onboarding, auth, search, editor parsing, settings data loading, or the current uncommitted feature additions. Keep the approved Topbar/Sidebar double-notch selectors and remove only old full-length dividers or hard shadows.

- [ ] **Step 4: Verify and commit**

```bash
bun run test:unit -- tests/unit/ui/module-style-contract.spec.ts tests/unit/system tests/unit/components/AppTopbarAuthControls.spec.ts tests/unit/components/TopbarSearchAuthControls.spec.ts tests/unit/components/setting
bun run type-check
git add src/style.css src/components/system src/components/shared/CommentThread.vue src/components/shared/InteractionBar.vue src/components/shared/PEditorRuntime.vue src/components/setting/SettingFeedSourcePanel.vue src/views/setting tests/unit/ui/module-style-contract.spec.ts
git commit -m "style(shell): converge shared application surfaces"
```

Expected: PASS.

### Task 7: Converge Blog and Feed surfaces

**Files:**
- Modify: `tests/unit/ui/module-style-contract.spec.ts`
- Modify: `src/components/blog/CommentSection.vue`, `PostCoverField.vue`, `PostEditorSidebar.vue`, `PostEditorTopbar.vue`
- Modify: `src/components/feed/FeedArticleSheet.vue`, `FeedSidebarSources.vue`, `FeedSourceArticlesSheet.vue`, `FeedSourceIdentityCard.vue`, `FeedTimelineFooter.vue`, `SubscriptionAddSheet.vue`, `SubscriptionManageSheet.vue`
- Modify: all affected Blog/Feed views listed in the test below.

- [ ] **Step 1: Add the failing Blog/Feed contract**

```ts
const blogFeedFiles = [
  'src/components/blog/CommentSection.vue',
  'src/components/blog/PostCoverField.vue',
  'src/components/blog/PostEditorSidebar.vue',
  'src/components/blog/PostEditorTopbar.vue',
  'src/components/feed/FeedArticleSheet.vue',
  'src/components/feed/FeedSidebarSources.vue',
  'src/components/feed/FeedSourceArticlesSheet.vue',
  'src/components/feed/FeedSourceIdentityCard.vue',
  'src/components/feed/FeedTimelineFooter.vue',
  'src/components/feed/SubscriptionAddSheet.vue',
  'src/components/feed/SubscriptionManageSheet.vue',
  'src/views/blog/BlogHomeView.vue',
  'src/views/blog/BlogManageView.vue',
  'src/views/blog/BlogSubscriptionsView.vue',
  'src/views/blog/BookmarkView.vue',
  'src/views/blog/ChannelManageDetailView.vue',
  'src/views/blog/ChannelManageView.vue',
  'src/views/blog/ChannelView.vue',
  'src/views/blog/CollectionManageView.vue',
  'src/views/blog/CollectionView.vue',
  'src/views/blog/PostDetailView.vue',
  'src/views/blog/PostEditorView.vue',
  'src/views/blog/ProfileView.vue',
  'src/views/feed/FeedItemDetailView.vue',
  'src/views/feed/FeedReadingListView.vue',
  'src/views/feed/FeedRecommendedView.vue',
  'src/views/feed/FeedStarredView.vue',
  'src/views/feed/FeedStatsView.vue',
  'src/views/feed/FeedView.vue',
  'src/views/feed/InboxPage.vue',
]

it('keeps Blog and Feed surfaces on the global contract', () => {
  for (const path of blogFeedFiles) {
    const source = read(path)
    expect(source, path).not.toMatch(/font-weight:\s*(700|800|900|950)/)
    expect(source, path).not.toMatch(/border-radius:\s*(8px|10px|12px|16px|20px|24px|999px)/)
    expect(source, path).not.toMatch(/box-shadow:\s*(?:[1-9]|0\s+[1-9]|0\s+0\s+[1-9])/)
  }
})
```

- [ ] **Step 2: Run and verify failure**

```bash
bun run test:unit -- tests/unit/ui/module-style-contract.spec.ts
```

Expected: FAIL on the known Blog/Feed legacy declarations.

- [ ] **Step 3: Apply visual-only convergence**

Use `500`, zero letter spacing, `4px`, shallow `1px` borders, and `box-shadow: none` in the listed selectors. Preserve article reading widths, editor behavior, subscription data, Feed Sheet behavior, API requests, and router paths. Do not turn page sections into cards or add explanatory copy.

- [ ] **Step 4: Verify and commit**

```bash
bun run test:unit -- tests/unit/ui/module-style-contract.spec.ts tests/unit/views/blog tests/unit/views/feed tests/unit/components/feed tests/unit/system/blog-layering.spec.ts tests/unit/system/feed-layering.spec.ts
bun run type-check
git add src/components/blog src/components/feed src/views/blog src/views/feed tests/unit/ui/module-style-contract.spec.ts
git commit -m "style(content): converge Blog and Feed surfaces"
```

Expected: PASS.

### Task 8: Converge community, podcast, timeline, portal, and system pages

**Files:**
- Modify: `tests/unit/ui/module-style-contract.spec.ts`
- Modify: affected components/views listed in the test below.

- [ ] **Step 1: Add the failing remaining-module contract**

```ts
const remainingModuleFiles = [
  'src/components/debate/ArgumentNode.vue',
  'src/components/debate/DebateHeaderActions.vue',
  'src/components/forum/ForumReplyNode.vue',
  'src/components/podcast/PodcastCommentSection.vue',
  'src/views/debate/DebateHomeView.vue',
  'src/views/forum/ForumHomeView.vue',
  'src/views/forum/ForumSearchView.vue',
  'src/views/forum/ForumTopicView.vue',
  'src/views/podcast/PodcastEditorView.vue',
  'src/views/podcast/PodcastEpisodeView.vue',
  'src/views/podcast/PodcastFavoritesView.vue',
  'src/views/podcast/PodcastHomeView.vue',
  'src/views/podcast/PodcastShowView.vue',
  'src/views/podcast/PodcastSubscriptionsView.vue',
  'src/views/podcast/creator/PodcastCreatorAnalytics.vue',
  'src/views/podcast/creator/PodcastCreatorDashboard.vue',
  'src/views/podcast/creator/PodcastCreatorManage.vue',
  'src/views/timeline/PersonListView.vue',
  'src/views/timeline/PersonMapView.vue',
  'src/views/timeline/TimelineHomeView.vue',
  'src/views/timeline/TimelineMapPane.vue',
  'src/views/portal/HomeView.vue',
  'src/views/portal/PortalView.vue',
  'src/views/system/AboutView.vue',
  'src/views/system/NotFoundView.vue',
  'src/views/system/UnknownSiteView.vue',
]

it('keeps remaining module surfaces on the global contract', () => {
  for (const path of remainingModuleFiles) {
    const source = read(path)
    expect(source, path).not.toMatch(/font-weight:\s*(700|800|900|950)/)
    expect(source, path).not.toMatch(/border-radius:\s*(8px|10px|12px|16px|20px|24px|999px)/)
    expect(source, path).not.toMatch(/box-shadow:\s*(?:[1-9]|0\s+[1-9]|0\s+0\s+[1-9])/)
  }
})
```

- [ ] **Step 2: Run and verify failure**

```bash
bun run test:unit -- tests/unit/ui/module-style-contract.spec.ts
```

Expected: FAIL on known module legacy declarations.

- [ ] **Step 3: Apply the approved shared declarations**

Use the same exact visual declarations:

```css
font-weight: 500;
letter-spacing: 0;
border-radius: 4px;
box-shadow: none;
```

Preserve map rendering, charts, podcast audio behavior, forum threading, debate structure, and portal routing. Circles remain allowed only for radio controls and true status dots.

- [ ] **Step 4: Verify and commit**

```bash
bun run test:unit -- tests/unit/ui/module-style-contract.spec.ts tests/unit/views/forum tests/unit/views/debate tests/unit/views/podcast tests/unit/views/timeline tests/unit/system
bun run type-check
git add src/components/debate src/components/forum src/components/podcast src/views/debate src/views/forum src/views/podcast src/views/timeline src/views/portal src/views/system tests/unit/ui/module-style-contract.spec.ts
git commit -m "style(modules): converge remaining frontend surfaces"
```

Expected: PASS.

### Task 9: Verify module convergence

**Files:**
- No source changes expected.

- [ ] **Step 1: Run full checks**

```bash
bun run type-check
bun run test:unit
bun run build
```

Expected: all commands exit `0`.

- [ ] **Step 2: Start the approved development server**

```bash
~/.claude/skills/brainstorming/scripts/start-server.sh \
  --project-dir /Users/fafa/projects/Atoman/Atoman-Frontend \
  --host 0.0.0.0 \
  --url-host localhost \
  --foreground
```

After the server prints its startup JSON, verify it from another shell call:

```bash
SESSION_DIR="$(ls -td .superpowers/brainstorm/*/ | head -n 1)"
URL="$(sed -n 's/.*"url":"\([^"]*\)".*/\1/p' "$SESSION_DIR/state/server-info")"
curl -s -o /dev/null -w '%{http_code}\n' "$URL/"
```

Expected: `200`.

- [ ] **Step 3: Verify desktop and mobile visuals**

Check `/videos`, `/videos/subscriptions`, `/videos/favorites`, `/videos/creator`, a video detail page, `/music`, an artist Sheet, and an album Sheet at desktop and `390x844`. Confirm 4px media/avatar geometry, no hard shadows, 500-weight headings, always-visible video statistics, Hover/Focus/touch watch-later access, Lucide icons, no overlap, and concise labels.

- [ ] **Step 4: Stop server and confirm clean state**

```bash
SESSION_DIR="$(ls -td .superpowers/brainstorm/*/ | head -n 1)"
~/.claude/skills/brainstorming/scripts/stop-server.sh "$SESSION_DIR"
git status --short
```

Expected: stopped server and no Git output.
