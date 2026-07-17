import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AlbumsView from '@/views/music/AlbumsView.vue'

const mocks = vi.hoisted(() => ({
  listRecommendedAlbums: vi.fn(),
  listMusicAlbums: vi.fn(),
  listAlbumBookmarks: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  listRecommendedAlbums: mocks.listRecommendedAlbums,
  listMusicAlbums: mocks.listMusicAlbums,
  listAlbumBookmarks: mocks.listAlbumBookmarks,
  createAlbumBookmark: vi.fn(),
  deleteAlbumBookmark: vi.fn(),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({ openAlbum: vi.fn(), isMainShifted: { value: false } }),
}))

describe('Music AlbumsView.vue', () => {
  beforeEach(() => {
    mocks.listRecommendedAlbums.mockReset()
    mocks.listMusicAlbums.mockReset()
    mocks.listAlbumBookmarks.mockResolvedValue({ data: [] })
    mocks.listRecommendedAlbums.mockResolvedValue({
      data: [{ id: 'album-1', title: 'Album One', target_path: '/music/album/album-1' }],
    })
  })

  it('loads albums with the shared browse modes', async () => {
    const wrapper = mount(AlbumsView, {
      global: {
        stubs: {
          PPageHeader: { props: ['title'], template: '<div><h1>{{ title }}</h1><slot name="action" /></div>' },
          PSegmentedControl: { props: ['options'], template: '<div><span v-for="o in options" :key="o.value">{{ o.label }}</span></div>' },
          AlbumDrawer: true,
          NestedActionDrawer: true,
        },
      },
    })
    await flushPromises()

    expect(mocks.listRecommendedAlbums).toHaveBeenCalledWith('hot')
    expect(wrapper.text()).toContain('专辑')
    expect(wrapper.text()).toContain('热度')
    expect(wrapper.text()).toContain('精选')
    expect(wrapper.text()).toContain('最新')
    expect(wrapper.findAll('[data-testid="album-card"]')).toHaveLength(1)
  })

  it('searches within albums', async () => {
    mocks.listMusicAlbums.mockResolvedValue({ data: [], meta: { page: 1, page_size: 48, total: 0, has_more: false } })
    const wrapper = mount(AlbumsView, {
      global: { stubs: { AlbumDrawer: true, NestedActionDrawer: true } },
    })
    await flushPromises()

    await wrapper.get('input[placeholder="搜索专辑..."]').setValue('demo')
    await flushPromises()
    expect(mocks.listMusicAlbums).toHaveBeenLastCalledWith({ q: 'demo', page: 1, page_size: 48, sort: 'hot' })
  })

  it('uses the current loading skeleton and empty state', async () => {
    mocks.listRecommendedAlbums.mockReturnValue(new Promise(() => {}))
    const loadingWrapper = mount(AlbumsView, {
      global: { stubs: { AlbumDrawer: true, NestedActionDrawer: true } },
    })
    await loadingWrapper.vm.$nextTick()

    expect(loadingWrapper.find('.a-skeleton').exists()).toBe(true)

    loadingWrapper.unmount()
    mocks.listRecommendedAlbums.mockResolvedValue({ data: [] })
    const emptyWrapper = mount(AlbumsView, {
      global: { stubs: { AlbumDrawer: true, NestedActionDrawer: true } },
    })
    await flushPromises()

    expect(emptyWrapper.find('.p-empty').exists()).toBe(true)
    expect(emptyWrapper.text()).toContain('暂无专辑')
  })

  it('shows a retry action when albums fail to load', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.listRecommendedAlbums.mockRejectedValueOnce(new Error('network'))
    const wrapper = mount(AlbumsView, {
      global: { stubs: { AlbumDrawer: true, NestedActionDrawer: true } },
    })
    await flushPromises()

    expect(wrapper.find('.p-empty').exists()).toBe(true)
    expect(wrapper.text()).toContain('专辑加载失败')

    await wrapper.get('[data-testid="retry-albums"]').trigger('click')
    await flushPromises()

    expect(mocks.listRecommendedAlbums).toHaveBeenCalledTimes(2)
    expect(wrapper.findAll('[data-testid="album-card"]')).toHaveLength(1)
    consoleError.mockRestore()
  })
})
