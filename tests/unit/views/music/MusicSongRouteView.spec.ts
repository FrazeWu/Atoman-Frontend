import { flushPromises, mount } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MusicSongRouteView from '@/views/music/MusicSongRouteView.vue'

const mocks = vi.hoisted(() => ({
  getMusicSongDetail: vi.fn(),
  route: { params: { songId: 'song-1' } },
  drawerState: { songRefreshToken: 0 },
}))
const route = reactive(mocks.route)
const drawerState = ref(mocks.drawerState)

vi.mock('@/api/musicV1', () => ({
  getMusicSongDetail: mocks.getMusicSongDetail,
  addMusicSongToLater: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('@/stores/player', () => ({ usePlayerStore: () => ({ playSong: vi.fn(), addToQueue: vi.fn() }) }))
vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: drawerState, openAlbum: vi.fn(), openArtist: vi.fn(),
    openMusicEditor: vi.fn(), openNestedAction: vi.fn(),
  }),
}))
vi.mock('@/composables/useLoginRedirect', () => ({ useLoginRedirect: () => ({ requireLogin: () => true }) }))
vi.mock('@/composables/useMusicFavoritePlaylist', () => ({
  useMusicFavoritePlaylist: () => ({ favoriteSongIds: ref(new Set<string>()), toggleFavoriteSong: vi.fn() }),
}))

function detail(id: string, title: string) {
  return {
    song: { id, title, audio_url: `/${id}.mp3`, artists: [], status: 'open' },
    artists: [], bookmarked: false, playable: true, previous: null, next: null,
  }
}

describe('MusicSongRouteView', () => {
  beforeEach(() => {
    mocks.getMusicSongDetail.mockReset()
    route.params.songId = 'song-1'
    drawerState.value.songRefreshToken = 0
  })

  it('ignores an obsolete response after navigating to another song', async () => {
    let resolveFirst!: (value: ReturnType<typeof detail>) => void
    const first = new Promise<ReturnType<typeof detail>>(resolve => { resolveFirst = resolve })
    mocks.getMusicSongDetail
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(detail('song-2', 'Second Song'))

    const wrapper = mount(MusicSongRouteView, {
      global: {
        stubs: {
          RouterLink: { props: ['to'], template: '<a><slot /></a>' },
          PToast: { template: '<div />' },
        },
      },
    })
    route.params.songId = 'song-2'
    await flushPromises()
    expect(wrapper.text()).toContain('Second Song')

    resolveFirst(detail('song-1', 'First Song'))
    await flushPromises()
    expect(wrapper.text()).toContain('Second Song')
    expect(wrapper.text()).not.toContain('First Song')
  })
})
