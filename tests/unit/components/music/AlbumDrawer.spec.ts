import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'

const { openNestedAction, getMusicAlbum } = vi.hoisted(() => ({
  openNestedAction: vi.fn(),
  getMusicAlbum: vi.fn(),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: { value: { albumId: '1' } },
    closeAlbum: vi.fn(),
    isAlbumShifted: { value: false },
    openNestedAction
  })
}))

vi.mock('@/api/musicV1', () => ({
  getMusicAlbum,
}))

describe('AlbumDrawer.vue', () => {
  beforeEach(() => {
    openNestedAction.mockReset()
    getMusicAlbum.mockReset()
    getMusicAlbum.mockResolvedValue({
      id: '1',
      title: 'Test Album',
      release_date: '2024-01-01',
      album_type: 'album',
      entry_status: 'open',
      songs: [
        { id: 'song-1', title: 'First Song', track_number: 1 },
        { id: 'song-2', title: 'Second Song', track_number: 2 },
      ],
    })
  })

  it('renders correctly', () => {
    const wrapper = mount(AlbumDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
          PDiscussionFAB: { props: ['count'], template: '<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>' },
        },
      },
    })
    expect(wrapper.text()).toContain('Album Notes')
  })

  it('hides unimplemented primary actions instead of rendering clickable buttons', async () => {
    const wrapper = mount(AlbumDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
          PDiscussionFAB: { props: ['count'], template: '<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>' },
        },
      },
    })

    await flushPromises()

    expect(wrapper.findAll('button').some(button => button.text().includes('播放全专'))).toBe(false)
    expect(wrapper.findAll('button').some(button => button.text().includes('收藏'))).toBe(false)
    expect(wrapper.text()).toContain('播放全专')
    expect(wrapper.text()).toContain('收藏')
  })

  it('does not show hard-coded discussion count or fake track durations when data is absent', async () => {
    const wrapper = mount(AlbumDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
          PDiscussionFAB: { props: ['count'], template: '<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>' },
        },
      },
    })

    await flushPromises()

    expect(wrapper.get('[data-test="discussion-fab"]').text()).toBe('讨论')
    expect(wrapper.text()).not.toContain('03:45')
    expect(wrapper.find('.track-time').exists()).toBe(false)
  })

  it('shows discussion count and track durations when real data exists', async () => {
    getMusicAlbum.mockResolvedValue({
      id: '1',
      title: 'Test Album',
      release_date: '2024-01-01',
      album_type: 'album',
      entry_status: 'open',
      discussion_count: 7,
      songs: [
        { id: 'song-1', title: 'First Song', track_number: 1, duration_sec: 125 },
      ],
    })

    const wrapper = mount(AlbumDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
          PDiscussionFAB: { props: ['count'], template: '<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>' },
        },
      },
    })

    await flushPromises()

    expect(wrapper.get('[data-test="discussion-fab"]').text()).toBe('讨论(7)')
    expect(wrapper.get('.track-time').text()).toBe('2:05')
  })

  it('renders an edit entry that points to the album edit route', async () => {
    const wrapper = mount(AlbumDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
          PDiscussionFAB: { props: ['count'], template: '<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>' },
        },
      },
    })

    await flushPromises()

    const editLink = wrapper.find('a.paper-action')
    expect(editLink.exists()).toBe(true)
    expect(editLink.text()).toContain('编辑')
    expect(editLink.attributes('href')).toBe('/music/album/1/edit')
  })
})
