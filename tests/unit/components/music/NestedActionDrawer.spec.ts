import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import NestedActionDrawer from '@/components/music/NestedActionDrawer.vue'

const mocks = vi.hoisted(() => ({
  drawerState: {
    value: {
      artistId: null as string | null,
      albumId: null as string | null,
      nestedAction: 'history' as string | null,
      nestedPayload: null as unknown,
    },
  },
  closeNestedAction: vi.fn(),
  submitMusicEdit: vi.fn(),
  listMusicArtists: vi.fn(),
  uploadMusicAsset: vi.fn(),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: mocks.drawerState,
    closeNestedAction: mocks.closeNestedAction,
  }),
}))

vi.mock('@/api/musicV1', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/musicV1')>()
  return {
    ...actual,
    listMusicArtists: mocks.listMusicArtists,
    uploadMusicAsset: mocks.uploadMusicAsset,
    submitMusicEdit: mocks.submitMusicEdit,
  }
})

describe('NestedActionDrawer.vue', () => {
  beforeEach(() => {
    mocks.drawerState.value = { artistId: null, albumId: null, nestedAction: 'history', nestedPayload: null }
    mocks.closeNestedAction.mockReset()
    mocks.submitMusicEdit.mockReset()
    mocks.listMusicArtists.mockReset()
    mocks.uploadMusicAsset.mockReset()
    mocks.listMusicArtists.mockResolvedValue({
      data: [{ id: 'artist-2', name: 'Selected Artist', entry_status: 'open' }],
      meta: { page: 1, page_size: 10, total: 1, has_more: false },
    })
    mocks.uploadMusicAsset.mockResolvedValue({
      url: 'https://cdn.example.com/assets/music/covers/uploads/users/user-1/2026/06/artist-avatar.png',
      key: 'music/covers/uploads/users/user-1/2026/06/artist-avatar.png',
      content_type: 'image/png',
      size: 1,
    })
    mocks.submitMusicEdit.mockResolvedValue({
      id: 'edit-1',
      type: 'create_artist',
      status: 'open',
      entity_type: 'artist',
      submitted_by: 'user-1',
      auto_applied: false,
      votable: true,
      votes: { yes: 0, no: 0 },
      created_at: '2026-06-17T00:00:00Z',
    })
  })

  it('renders when action is present', () => {
    const wrapper = mount(NestedActionDrawer, { global: { stubs: ['PSheet'] } })
    expect(wrapper.findComponent({ name: 'PSheet' }).exists()).toBe(true)
  })

  it('renders and submits the optimized add artist wiki edit form', async () => {
    mocks.drawerState.value = { artistId: null, albumId: null, nestedAction: 'add_artist', nestedPayload: null }
    const wrapper = mount(NestedActionDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
        },
      },
    })

    expect(wrapper.text()).toContain('艺术家名称')
    expect(wrapper.text()).toContain('个人简介')
    expect(wrapper.text()).toContain('头像上传')
    expect(wrapper.find('[data-test="artist-avatar-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="artist-nationality-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="artist-birth-date-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="artist-source-url-input"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('编辑摘要')

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    await wrapper.get('[data-test="artist-name-input"]').setValue('New Artist')
    await wrapper.get('[data-test="artist-bio-input"]').setValue('artist biography')
    const avatarInput = wrapper.get<HTMLInputElement>('[data-test="artist-avatar-input"]')
    Object.defineProperty(avatarInput.element, 'files', { value: [file], configurable: true })
    await avatarInput.trigger('change')
    await wrapper.get('[data-test="artist-nationality-select"]').setValue('JP')
    await wrapper.get('[data-test="artist-birth-date-input"]').setValue('1990-05-21')
    await wrapper.get('[data-test="artist-source-url-input"]').setValue('https://example.com/profile')
    await wrapper.get('[data-test="music-edit-submit"]').trigger('submit')

    expect(mocks.uploadMusicAsset).toHaveBeenCalledWith(file, 'music.cover')
    expect(mocks.submitMusicEdit).toHaveBeenCalledWith({
      type: 'create_artist',
      entity_type: 'artist',
      payload: {
        name: 'New Artist',
        bio: 'artist biography',
        image_url: 'https://cdn.example.com/assets/music/covers/uploads/users/user-1/2026/06/artist-avatar.png',
        nationality: 'JP',
        birth_date: '1990-05-21',
        birth_year: 1990,
      },
      changes: {},
      reason: '创建艺术家资料',
      sources: [{ type: 'url', url: 'https://example.com/profile' }],
    })
    expect(mocks.closeNestedAction).toHaveBeenCalled()
  })

  it('renders and submits the add album wiki edit form for the selected artist', async () => {
    mocks.drawerState.value = { artistId: 'artist-1', albumId: null, nestedAction: 'add_album', nestedPayload: null }
    const wrapper = mount(NestedActionDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
        },
      },
    })

    expect(wrapper.text()).toContain('专辑名称')
    expect(wrapper.text()).toContain('发行日期')
    expect(wrapper.text()).toContain('编辑摘要')

    await wrapper.get('[data-test="album-title-input"]').setValue('New Album')
    await wrapper.get('[data-test="album-release-date-input"]').setValue('2026-06-17')
    await wrapper.get('[data-test="edit-reason-input"]').setValue('official release')
    await wrapper.get('[data-test="music-edit-submit"]').trigger('submit')

    expect(mocks.submitMusicEdit).toHaveBeenCalledWith({
      type: 'create_album',
      entity_type: 'album',
      payload: {
        title: 'New Album',
        artist_ids: ['artist-1'],
        release_date: '2026-06-17',
        album_type: 'album',
      },
      changes: {},
      reason: 'official release',
      sources: [],
    })
    expect(mocks.closeNestedAction).toHaveBeenCalled()
  })

  it('selects artists before submitting an add album wiki edit from the home page', async () => {
    mocks.drawerState.value = { artistId: null, albumId: null, nestedAction: 'add_album', nestedPayload: null }
    const wrapper = mount(NestedActionDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
        },
      },
    })

    expect(wrapper.text()).toContain('关联艺术家')

    await wrapper.get('[data-test="album-artist-search-input"]').setValue('selected')
    await wrapper.get('[data-test="album-artist-search-button"]').trigger('click')
    await wrapper.get('[data-test="album-artist-option"]').trigger('click')
    await wrapper.get('[data-test="album-title-input"]').setValue('Home Album')
    await wrapper.get('[data-test="edit-reason-input"]').setValue('official release')
    await wrapper.get('[data-test="music-edit-submit"]').trigger('submit')

    expect(mocks.listMusicArtists).toHaveBeenCalledWith({ q: 'selected', page: 1, page_size: 10 })
    expect(mocks.submitMusicEdit).toHaveBeenCalledWith({
      type: 'create_album',
      entity_type: 'album',
      payload: {
        title: 'Home Album',
        artist_ids: ['artist-2'],
        album_type: 'album',
      },
      changes: {},
      reason: 'official release',
      sources: [],
    })
    expect(mocks.closeNestedAction).toHaveBeenCalled()
  })
})
