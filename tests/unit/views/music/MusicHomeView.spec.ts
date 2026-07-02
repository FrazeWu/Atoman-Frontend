import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import HomeView from '@/views/music/HomeView.vue'

const mocks = vi.hoisted(() => ({
  listMusicArtists: vi.fn(),
  openAlbum: vi.fn(),
  openArtist: vi.fn(),
  openNestedAction: vi.fn(),
  openMusicCreationFlow: vi.fn(),
  drawerStateValue: {
    artistId: null as string | null,
    albumId: null as string | null,
    nestedAction: null as string | null,
    nestedPayload: null as unknown,
    creationFlow: null as unknown,
  },
  routeQuery: {} as Record<string, string>,
}))

vi.mock('@/api/musicV1', () => ({
  listMusicArtists: mocks.listMusicArtists,
  listArtistBookmarks: vi.fn().mockResolvedValue({ data: [] }),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: ref(mocks.drawerStateValue),
    isMainShifted: computed(() => false),
    openAlbum: mocks.openAlbum,
    openArtist: mocks.openArtist,
    openNestedAction: mocks.openNestedAction,
    openMusicCreationFlow: mocks.openMusicCreationFlow,
    closeMusicCreationFlow: vi.fn(),
    setMusicCreationStep: vi.fn(),
    isCreationFlowOpen: computed(() => false),
  }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: mocks.routeQuery,
  }),
}))

describe('Music HomeView.vue (Artist Discovery)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.listMusicArtists.mockReset()
    mocks.openAlbum.mockReset()
    mocks.openArtist.mockReset()
    mocks.openNestedAction.mockReset()
    mocks.openMusicCreationFlow.mockReset()
    mocks.drawerStateValue = {
      artistId: null,
      albumId: null,
      nestedAction: null,
      nestedPayload: null,
      creationFlow: null,
    }
    mocks.routeQuery = {}
    mocks.listMusicArtists.mockResolvedValue({
      data: [
        {
          id: 'artist-1',
          name: 'Hot Artist',
          nationality: 'UK',
          bio: 'Artist bio',
        },
      ],
      meta: { page: 1, page_size: 48, total: 1, has_more: false },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads artists by default and renders an artist grid', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(HomeView, {
      global: {
        plugins: [pinia],
        stubs: {
          RouterLink: true,
          ArtistDrawer: true,
          AlbumDrawer: true,
          NestedActionDrawer: true,
          MusicCreationFlowDrawer: { template: '<div data-testid="music-creation-flow-drawer-stub" />' },
          PSegmentedControl: { props: ['options'], template: '<div><button v-for="o in options" :key="o.value">{{ o.label }}</button></div>' },
        },
      },
    })
    await flushPromises()

    expect(mocks.listMusicArtists).toHaveBeenCalledWith({ q: undefined, page: 1, page_size: 48 })
    expect(wrapper.find('h1').text()).toContain('艺术家')
    expect(wrapper.find('.search-input').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="artist-card"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Hot Artist')
    expect(wrapper.text()).toContain('UK')
  })

  it('opens artist drawers from artist cards', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(HomeView, {
      global: {
        plugins: [pinia],
        stubs: {
          RouterLink: true,
          ArtistDrawer: true,
          AlbumDrawer: true,
          NestedActionDrawer: true,
          MusicCreationFlowDrawer: { template: '<div data-testid="music-creation-flow-drawer-stub" />' },
          PSegmentedControl: { props: ['options'], template: '<div><button v-for="o in options" :key="o.value">{{ o.label }}</button></div>' },
        },
      },
    })
    await flushPromises()

    await wrapper.find('[data-testid="artist-card"]').trigger('click')
    expect(mocks.openArtist).toHaveBeenCalledWith('artist-1')
  })

  it('shows search results in dropdown and opens artist from there', async () => {
    mocks.listMusicArtists
      .mockResolvedValueOnce({
        data: [
          {
            id: 'artist-1',
            name: 'Default Artist',
            nationality: 'UK',
            bio: 'Default bio',
          },
        ],
        meta: { page: 1, page_size: 48, total: 1, has_more: false },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'artist-2',
            name: 'Ye',
            legal_name: 'Kanye',
            bio: 'Search bio',
          },
        ],
        meta: { page: 1, page_size: 20, total: 1, has_more: false },
      })

    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(HomeView, {
      global: {
        plugins: [pinia],
        stubs: {
          RouterLink: true,
          ArtistDrawer: true,
          AlbumDrawer: true,
          NestedActionDrawer: true,
          MusicCreationFlowDrawer: { template: '<div data-testid="music-creation-flow-drawer-stub" />' },
          PSegmentedControl: { props: ['options'], template: '<div><button v-for="o in options" :key="o.value">{{ o.label }}</button></div>' },
        },
      },
    })
    await flushPromises()

    const input = wrapper.find('input[placeholder="搜索艺术家..."]')
    await input.trigger('focus')
    await input.setValue('kanye')
    await flushPromises()

    expect(wrapper.find('[data-testid="music-search-dropdown"]').exists()).toBe(true)
    expect(mocks.listMusicArtists).toHaveBeenLastCalledWith({ q: 'kanye', page: 1, page_size: 20 })
    expect(wrapper.findAll('[data-testid="artist-card"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Default Artist')
    expect(wrapper.text()).toContain('Ye')

    await wrapper.find('[data-testid="music-search-result"]').trigger('mousedown')
    expect(mocks.openArtist).toHaveBeenCalledWith('artist-2')
  })

  it('offers wiki edit actions when no artists match', async () => {
    mocks.listMusicArtists.mockResolvedValueOnce({
      data: [],
      meta: { page: 1, page_size: 48, total: 0, has_more: false },
    })
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(HomeView, {
      global: {
        plugins: [pinia],
        stubs: {
          RouterLink: true,
          ArtistDrawer: true,
          AlbumDrawer: true,
          NestedActionDrawer: true,
          MusicCreationFlowDrawer: { template: '<div data-testid="music-creation-flow-drawer-stub" />' },
          PSegmentedControl: { props: ['options'], template: '<div><button v-for="o in options" :key="o.value">{{ o.label }}</button></div>' },
        },
      },
    })
    await flushPromises()

    await wrapper.find('[data-testid="empty-add-artist"]').trigger('click')

    expect(mocks.openMusicCreationFlow).toHaveBeenCalledTimes(1)
    expect(mocks.openMusicCreationFlow).toHaveBeenCalledWith({ startStep: 'artist' })
  })
})
