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

  it('renders and submits the revise artist wiki edit form', async () => {
    mocks.drawerState.value = { artistId: 'artist-1', albumId: null, nestedAction: 'revise_artist', nestedPayload: null }
    const wrapper = mount(NestedActionDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
        },
      },
    })

    expect(wrapper.text()).toContain('名字')
    expect(wrapper.text()).toContain('个人简介')
    expect(wrapper.text()).toContain('头像链接')
    expect(wrapper.text()).toContain('地区')
    expect(wrapper.text()).toContain('出生年月日')
    expect(wrapper.text()).toContain('编辑摘要')

    await wrapper.get('[data-test="artist-name-input"]').setValue('Revised Artist')
    await wrapper.get('[data-test="artist-bio-input"]').setValue('revised biography')
    await wrapper.get('[data-test="edit-reason-input"]').setValue('update bio and name')
    await wrapper.get('[data-test="music-edit-submit"]').trigger('submit')

    expect(mocks.submitMusicEdit).toHaveBeenCalledWith({
      type: 'update_artist',
      entity_type: 'artist',
      entity_id: 'artist-1',
      payload: {},
      changes: {
        name: 'Revised Artist',
        bio: 'revised biography',
      },
      reason: 'update bio and name',
      sources: [],
    })
    expect(mocks.closeNestedAction).toHaveBeenCalled()
  })

  it('renders and submits the revise album wiki edit form', async () => {
    mocks.drawerState.value = { artistId: 'artist-1', albumId: 'album-1', nestedAction: 'revise', nestedPayload: null }
    const wrapper = mount(NestedActionDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
        },
      },
    })

    expect(wrapper.text()).toContain('名字')
    expect(wrapper.text()).toContain('专辑简介')
    expect(wrapper.text()).toContain('发行时间')
    expect(wrapper.text()).toContain('编辑摘要')

    await wrapper.get('[data-test="album-title-input"]').setValue('Revised Album')
    await wrapper.get('[data-test="album-release-date-input"]').setValue('2026-06-21')
    await wrapper.get('[data-test="edit-reason-input"]').setValue('official revision')
    await wrapper.get('[data-test="music-edit-submit"]').trigger('submit')

    expect(mocks.submitMusicEdit).toHaveBeenCalledWith({
      type: 'update_album',
      entity_type: 'album',
      entity_id: 'album-1',
      payload: {},
      changes: {
        title: 'Revised Album',
        release_date: '2026-06-21',
        album_type: 'album',
      },
      reason: 'official revision',
      sources: [],
    })
    expect(mocks.closeNestedAction).toHaveBeenCalled()
  })
})
