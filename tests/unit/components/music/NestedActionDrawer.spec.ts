import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  refreshAlbum: vi.fn(),
  submitMusicEdit: vi.fn(),
  updateMusicArtist: vi.fn(),
  listMusicArtists: vi.fn(),
  uploadMusicAsset: vi.fn(),
  listAlbumRevisions: vi.fn(),
  listArtistRevisions: vi.fn(),
  getAlbumRevision: vi.fn(),
  revertAlbumRevision: vi.fn(),
  listAlbumDiscussions: vi.fn(),
  createAlbumDiscussion: vi.fn(),
  replyAlbumDiscussion: vi.fn(),
  deleteAlbumDiscussion: vi.fn(),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: mocks.drawerState,
    closeNestedAction: mocks.closeNestedAction,
    refreshAlbum: mocks.refreshAlbum,
    isLayerShifted: () => true,
    isTopLayer: () => false,
  }),
}))

vi.mock('@/api/musicV1', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/musicV1')>()
  return {
    ...actual,
    listMusicArtists: mocks.listMusicArtists,
    uploadMusicAsset: mocks.uploadMusicAsset,
    submitMusicEdit: mocks.submitMusicEdit,
    updateMusicArtist: mocks.updateMusicArtist,
    listAlbumRevisions: mocks.listAlbumRevisions,
    listArtistRevisions: mocks.listArtistRevisions,
    getAlbumRevision: mocks.getAlbumRevision,
    revertAlbumRevision: mocks.revertAlbumRevision,
    listAlbumDiscussions: mocks.listAlbumDiscussions,
    createAlbumDiscussion: mocks.createAlbumDiscussion,
    replyAlbumDiscussion: mocks.replyAlbumDiscussion,
    deleteAlbumDiscussion: mocks.deleteAlbumDiscussion,
  }
})

function buildRevision(overrides: Record<string, unknown> = {}) {
  return {
    id: 'revision-1',
    content_type: 'album',
    content_id: 'album-1',
    version_number: 2,
    previous_revision_id: 'revision-0',
    content_snapshot: {
      album: {
        title: 'Current Album',
        release_date: '2024-01-02',
        album_type: 'album',
      },
      songs: [{ id: 'song-1', title: 'Track A', track_number: 1 }],
    },
    editor_id: 'user-2',
    editor: { display_name: 'Editor Name', username: 'editor' },
    edit_summary: '更新专辑信息',
    edit_type: 'update_album',
    status: 'applied',
    is_current: false,
    created_at: '2026-06-17T00:00:00Z',
    ...overrides,
  }
}

function buildDiscussion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'discussion-1',
    album_id: 'album-1',
    parent_id: null,
    content: '主讨论内容',
    created_at: '2026-06-18T00:00:00Z',
    updated_at: '2026-06-18T00:00:00Z',
    author_id: 'user-1',
    author: {
      id: 'user-1',
      username: 'alice',
      display_name: 'Alice',
    },
    replies: [],
    can_delete: true,
    ...overrides,
  }
}

function mountDrawer() {
  return mount(NestedActionDrawer, {
    global: {
      stubs: {
        PSheet: { template: '<section><slot /></section>' },
      },
    },
  })
}

describe('NestedActionDrawer.vue', () => {
  beforeEach(() => {
    mocks.drawerState.value = { artistId: null, albumId: null, nestedAction: 'history', nestedPayload: null }
    mocks.closeNestedAction.mockReset()
    mocks.refreshAlbum.mockReset()
    mocks.submitMusicEdit.mockReset()
    mocks.updateMusicArtist.mockReset()
    mocks.listMusicArtists.mockReset()
    mocks.uploadMusicAsset.mockReset()
    mocks.listAlbumRevisions.mockReset()
    mocks.listArtistRevisions.mockReset()
    mocks.getAlbumRevision.mockReset()
    mocks.revertAlbumRevision.mockReset()
    mocks.listAlbumDiscussions.mockReset()
    mocks.createAlbumDiscussion.mockReset()
    mocks.replyAlbumDiscussion.mockReset()
    mocks.deleteAlbumDiscussion.mockReset()

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
    mocks.listAlbumRevisions.mockResolvedValue([])
    mocks.listArtistRevisions.mockResolvedValue([])
    mocks.updateMusicArtist.mockResolvedValue({
      id: 'artist-1',
      name: 'Revised Artist',
      bio: 'revised biography',
      entry_status: 'open',
    })
    mocks.getAlbumRevision.mockResolvedValue(buildRevision())
    mocks.revertAlbumRevision.mockResolvedValue(buildRevision({ is_current: true, version_number: 1 }))
    mocks.listAlbumDiscussions.mockResolvedValue([])
    mocks.createAlbumDiscussion.mockResolvedValue(buildDiscussion())
    mocks.replyAlbumDiscussion.mockResolvedValue(buildDiscussion({ id: 'discussion-2', parent_id: 'discussion-1', can_delete: true }))
    mocks.deleteAlbumDiscussion.mockResolvedValue({ success: true })
  })

  it('renders when action is present', () => {
    const wrapper = mountDrawer()
    expect(wrapper.html()).toContain('Music Wiki')
  })

  it('keeps a revision draft when another action becomes globally active', async () => {
    mocks.drawerState.value = { artistId: null, albumId: 'album-1', nestedAction: 'history', nestedPayload: null }
    const wrapper = mount(NestedActionDrawer, {
      props: {
        layer: {
          key: 'action:revise:album-1',
          kind: 'action',
          title: '修改专辑',
          payload: { action: 'revise', data: { albumId: 'album-1' } },
        },
        layerIndex: 1,
      },
      global: {
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
        },
      },
    })

    await wrapper.get('[data-test="edit-reason-input"]').setValue('保留这段修订说明')
    expect(wrapper.get('[data-test="edit-reason-input"]').element.value).toBe('保留这段修订说明')
  })

  it('loads read-only artist revision history', async () => {
    mocks.drawerState.value = { artistId: 'artist-1', albumId: null, nestedAction: 'artist_history', nestedPayload: null }
    mocks.listArtistRevisions.mockResolvedValue([buildRevision({
      content_type: 'artist',
      content_id: 'artist-1',
      edit_summary: '修改艺术家信息',
    })])

    const wrapper = mountDrawer()
    await flushPromises()

    expect(mocks.listArtistRevisions).toHaveBeenCalledWith('artist-1')
    expect(wrapper.text()).toContain('修改艺术家信息')
    expect(wrapper.text()).not.toContain('恢复到此版本')
  })

  it('renders and submits the revise artist wiki edit form', async () => {
    mocks.drawerState.value = { artistId: 'artist-1', albumId: null, nestedAction: 'revise_artist', nestedPayload: null }
    const wrapper = mountDrawer()

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

    expect(mocks.updateMusicArtist).toHaveBeenCalledWith('artist-1', {
      name: 'Revised Artist',
      bio: 'revised biography',
    })
    expect(mocks.closeNestedAction).toHaveBeenCalled()
  })

  it('renders and submits the revise album wiki edit form', async () => {
    mocks.drawerState.value = { artistId: 'artist-1', albumId: 'album-1', nestedAction: 'revise', nestedPayload: null }
    const wrapper = mountDrawer()

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

  it('loads album revisions when opening history and shows revision metadata', async () => {
    mocks.drawerState.value = { artistId: 'artist-1', albumId: 'album-1', nestedAction: 'history', nestedPayload: null }
    mocks.listAlbumRevisions.mockResolvedValue([
      buildRevision({ id: 'revision-2', version_number: 3, is_current: true }),
      buildRevision({ id: 'revision-1', version_number: 2 }),
    ])

    const wrapper = mountDrawer()
    await flushPromises()

    expect(mocks.listAlbumRevisions).toHaveBeenCalledWith('album-1')
    expect(wrapper.text()).toContain('v3')
    expect(wrapper.text()).toContain('当前版本')
    expect(wrapper.text()).toContain('更新专辑信息')
    expect(wrapper.text()).toContain('Editor Name')
  })

  it('shows revision diff summary after viewing a revision diff', async () => {
    mocks.drawerState.value = { artistId: 'artist-1', albumId: 'album-1', nestedAction: 'history', nestedPayload: null }
    mocks.listAlbumRevisions.mockResolvedValue([
      buildRevision({ id: 'revision-2', version_number: 2, previous_revision_id: 'revision-1' }),
    ])
    mocks.getAlbumRevision
      .mockResolvedValueOnce(buildRevision({
        version_number: 2,
        content_snapshot: {
          album: {
            title: 'Current Album',
            release_date: '2024-01-02',
            album_type: 'album',
          },
          songs: [{ id: 'song-1', title: 'Track A', track_number: 1 }],
        },
      }))
      .mockResolvedValueOnce(buildRevision({
        version_number: 1,
        content_snapshot: {
          album: {
            title: 'Old Album',
            release_date: '2024-01-01',
            album_type: 'ep',
          },
          songs: [],
        },
      }))

    const wrapper = mountDrawer()
    await flushPromises()
    await wrapper.get('[data-test="history-diff-button-2"]').trigger('click')
    await flushPromises()

    expect(mocks.getAlbumRevision).toHaveBeenCalledWith('album-1', 2)
    expect(mocks.getAlbumRevision).toHaveBeenCalledWith('album-1', 1)
    expect(wrapper.text()).toContain('专辑名：Old Album -> Current Album')
    expect(wrapper.text()).toContain('发行日期：2024-01-01 -> 2024-01-02')
    expect(wrapper.text()).toContain('新增曲目：Track A')
  })

  it('reverts to a selected revision from history', async () => {
    mocks.drawerState.value = { artistId: 'artist-1', albumId: 'album-1', nestedAction: 'history', nestedPayload: null }
    mocks.listAlbumRevisions
      .mockResolvedValueOnce([buildRevision({ id: 'revision-1', version_number: 1, previous_revision_id: null })])
      .mockResolvedValueOnce([buildRevision({ id: 'revision-1', version_number: 1, is_current: true, previous_revision_id: null })])

    const wrapper = mountDrawer()
    await flushPromises()
    await wrapper.get('[data-test="history-revert-button-1"]').trigger('click')
    await flushPromises()

    expect(mocks.revertAlbumRevision).toHaveBeenCalledWith('album-1', 1, '回滚到版本 v1')
    expect(mocks.refreshAlbum).toHaveBeenCalled()
    expect(mocks.listAlbumRevisions).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('已回滚到版本 v1')
  })

  it('loads album discussions and allows creating a new root discussion', async () => {
    mocks.drawerState.value = { artistId: 'artist-1', albumId: 'album-1', nestedAction: 'discussion', nestedPayload: null }
    mocks.listAlbumDiscussions.mockResolvedValue([
      buildDiscussion(),
    ])

    const wrapper = mountDrawer()
    await flushPromises()

    expect(mocks.listAlbumDiscussions).toHaveBeenCalledWith('album-1')
    expect(wrapper.text()).toContain('主讨论内容')

    await wrapper.get('[data-test="discussion-create-input"]').setValue('新讨论内容')
    await wrapper.get('[data-test="discussion-create-submit"]').trigger('submit')
    await flushPromises()

    expect(mocks.createAlbumDiscussion).toHaveBeenCalledWith('album-1', '新讨论内容')
    expect(mocks.listAlbumDiscussions).toHaveBeenCalledTimes(2)
  })

  it('allows replying to an album discussion', async () => {
    mocks.drawerState.value = { artistId: 'artist-1', albumId: 'album-1', nestedAction: 'discussion', nestedPayload: null }
    mocks.listAlbumDiscussions.mockResolvedValue([
      buildDiscussion(),
    ])

    const wrapper = mountDrawer()
    await flushPromises()

    await wrapper.get('[data-test="discussion-reply-toggle-discussion-1"]').trigger('click')
    await wrapper.get('[data-test="discussion-reply-input-discussion-1"]').setValue('这是一条回复')
    await wrapper.get('[data-test="discussion-reply-submit-discussion-1"]').trigger('submit')
    await flushPromises()

    expect(mocks.replyAlbumDiscussion).toHaveBeenCalledWith('album-1', 'discussion-1', '这是一条回复')
    expect(mocks.listAlbumDiscussions).toHaveBeenCalledTimes(2)
  })

  it('allows deleting own album discussion entry', async () => {
    mocks.drawerState.value = { artistId: 'artist-1', albumId: 'album-1', nestedAction: 'discussion', nestedPayload: null }
    mocks.listAlbumDiscussions.mockResolvedValue([
      buildDiscussion(),
    ])

    const wrapper = mountDrawer()
    await flushPromises()

    await wrapper.get('[data-test="discussion-delete-button-discussion-1"]').trigger('click')
    await flushPromises()

    expect(mocks.deleteAlbumDiscussion).toHaveBeenCalledWith('album-1', 'discussion-1')
    expect(mocks.listAlbumDiscussions).toHaveBeenCalledTimes(2)
  })
})
