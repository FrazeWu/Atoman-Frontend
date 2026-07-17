import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import ArtistsView from '@/views/music/ArtistsView.vue'

const mocks = vi.hoisted(() => ({
  listRecommendedArtists: vi.fn(),
  listMusicArtists: vi.fn(),
  getMusicArtist: vi.fn(),
  listArtistBookmarks: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  listRecommendedArtists: mocks.listRecommendedArtists,
  listMusicArtists: mocks.listMusicArtists,
  getMusicArtist: mocks.getMusicArtist,
  listArtistBookmarks: mocks.listArtistBookmarks,
  createArtistBookmark: vi.fn(),
  deleteArtistBookmark: vi.fn(),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({ openArtist: vi.fn(), isMainShifted: { value: false }, openMusicCreationFlow: vi.fn() }),
}))

async function mountArtistsView(stubs: Record<string, unknown> = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  await router.push('/')
  await router.isReady()

  return mount(ArtistsView, {
    global: {
      plugins: [router],
      stubs: {
        ArtistDrawer: true,
        AlbumDrawer: true,
        MusicCreationFlowDrawer: true,
        NestedActionDrawer: true,
        ...stubs,
      },
    },
  })
}

describe('Music ArtistsView.vue', () => {
  beforeEach(() => {
    mocks.listRecommendedArtists.mockReset()
    mocks.listMusicArtists.mockReset()
    mocks.listArtistBookmarks.mockResolvedValue({ data: [] })
    mocks.listRecommendedArtists.mockResolvedValue({
      data: [{ id: 'artist-1', title: 'Artist One', target_path: '/music/artist/artist-1' }],
    })
    mocks.getMusicArtist.mockResolvedValue({ id: 'artist-1', name: 'Artist One' })
  })

  it('renders the current artist filters and recommendation modes', async () => {
    const wrapper = await mountArtistsView({
      PPageHeader: { props: ['title'], template: '<div><h1>{{ title }}</h1><slot name="action" /></div>' },
      PSegmentedControl: { props: ['options'], template: '<div><span v-for="o in options" :key="o.value">{{ o.label }}</span></div>' },
    })
    await flushPromises()

    expect(mocks.listRecommendedArtists).toHaveBeenCalledWith('hot')
    expect(wrapper.text()).toContain('热度')
    expect(wrapper.text()).toContain('精选')
    expect(wrapper.text()).toContain('探索')
    expect(wrapper.text()).toContain('全部')
    expect(wrapper.text()).toContain('已订阅')
    expect(wrapper.findAll('[data-testid="artist-card"]')).toHaveLength(1)
    expect(wrapper.get('.paper-action').text()).toContain('添加艺术家')
  })

  it('searches within artists', async () => {
    mocks.listMusicArtists.mockResolvedValue({ data: [], meta: { page: 1, page_size: 48, total: 0, has_more: false } })
    const wrapper = await mountArtistsView()
    await flushPromises()

    await wrapper.get('input[placeholder="搜索艺术家..."]').setValue('demo')
    await flushPromises()
    expect(mocks.listMusicArtists).toHaveBeenLastCalledWith({ q: 'demo', page: 1, page_size: 48 })
  })

  it('uses the current loading skeleton and empty state', async () => {
    mocks.listRecommendedArtists.mockReturnValue(new Promise(() => {}))
    const loadingWrapper = await mountArtistsView()
    await loadingWrapper.vm.$nextTick()

    expect(loadingWrapper.get('.state-line').text()).toBe('正在加载艺术家...')

    loadingWrapper.unmount()
    mocks.listRecommendedArtists.mockResolvedValue({ data: [] })
    const emptyWrapper = await mountArtistsView()
    await flushPromises()

    expect(emptyWrapper.find('.empty-state').exists()).toBe(true)
    expect(emptyWrapper.text()).toContain('没有匹配的艺术家')
  })

  it('shows the artist loading error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.listRecommendedArtists.mockRejectedValueOnce(new Error('network'))
    const wrapper = await mountArtistsView()
    await flushPromises()

    expect(wrapper.get('.state-line--error').text()).toBe('艺术家列表加载失败')
    consoleError.mockRestore()
  })
})
