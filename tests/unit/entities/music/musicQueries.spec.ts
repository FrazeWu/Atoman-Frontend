import { describe, expect, it, vi } from 'vitest'
import {
  musicKeys,
  useSongQuery,
  useSongDetailQuery,
  useAlbumQuery,
  useAlbumDetailQuery,
  useArtistDetailQuery,
  usePlaylistDetailQuery,
  useLyricsQuery,
} from '@/entities/music'
import { createTestQueryClient } from '../../helpers/queryClient'
import { VUE_QUERY_CLIENT } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { defineComponent, toRef } from 'vue'
import * as musicApi from '@/entities/music/api/musicApi'

describe('musicKeys factory', () => {
  it('generates consistent hierarchical query keys', () => {
    expect(musicKeys.all).toEqual(['music'])
    expect(musicKeys.songs()).toEqual(['music', 'songs'])
    expect(musicKeys.song('song-123')).toEqual(['music', 'songs', 'song-123'])
    expect(musicKeys.songDetail('song-123')).toEqual(['music', 'songs', 'detail', 'song-123'])
    expect(musicKeys.lyrics('song-123')).toEqual(['music', 'songs', 'song-123', 'lyrics'])
    expect(musicKeys.albums()).toEqual(['music', 'albums'])
    expect(musicKeys.album('album-456')).toEqual(['music', 'albums', 'album-456'])
    expect(musicKeys.albumDetail('album-456')).toEqual(['music', 'albums', 'detail', 'album-456'])
    expect(musicKeys.artists()).toEqual(['music', 'artists'])
    expect(musicKeys.artist('artist-789')).toEqual(['music', 'artists', 'artist-789'])
    expect(musicKeys.artistDetail('artist-789')).toEqual(['music', 'artists', 'detail', 'artist-789'])
    expect(musicKeys.playlists()).toEqual(['music', 'playlists'])
    expect(musicKeys.playlist('playlist-999')).toEqual(['music', 'playlists', 'playlist-999'])
    expect(musicKeys.playlistDetail('playlist-999')).toEqual(['music', 'playlists', 'detail', 'playlist-999'])
  })
})

describe('useSongDetailQuery', () => {
  it('fetches song detail through musicApi', async () => {
    const mockDetail = {
      song: {
        id: 101,
        title: 'Echoes of Dawn',
        artist: 'Solaris',
      },
      artists: [],
      playable: true,
    }
    vi.spyOn(musicApi, 'fetchSongDetail').mockResolvedValue(mockDetail as any)

    const client = createTestQueryClient()
    const TestComponent = defineComponent({
      props: { songId: { type: String, required: true } },
      setup(props) {
        const query = useSongDetailQuery(toRef(props, 'songId'))
        return { query }
      },
      template: '<div><span v-if="query.data.value">{{ query.data.value.song.title }}</span></div>',
    })

    const wrapper = mount(TestComponent, {
      props: { songId: '101' },
      global: {
        provide: {
          [VUE_QUERY_CLIENT]: client,
        },
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Echoes of Dawn')
    })
  })
})

describe('useSongQuery', () => {
  it('fetches song detail through musicApi', async () => {
    const mockSong = {
      id: 101,
      title: 'Echoes of Dawn',
      artist: 'Solaris',
      audio_url: 'https://example.com/audio.mp3',
    }
    vi.spyOn(musicApi, 'fetchSongById').mockResolvedValue(mockSong as any)

    const client = createTestQueryClient()
    const TestComponent = defineComponent({
      props: { songId: { type: String, required: true } },
      setup(props) {
        const query = useSongQuery(toRef(props, 'songId'))
        return { query }
      },
      template: '<div><span v-if="query.data.value">{{ query.data.value.title }}</span></div>',
    })

    const wrapper = mount(TestComponent, {
      props: { songId: '101' },
      global: {
        provide: {
          [VUE_QUERY_CLIENT]: client,
        },
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Echoes of Dawn')
    })
  })
})

describe('useAlbumQuery', () => {
  it('fetches album detail through musicApi', async () => {
    const mockAlbum = {
      id: 456,
      title: 'Solaris Album',
      status: 'open' as const,
    }
    vi.spyOn(musicApi, 'fetchAlbumById').mockResolvedValue(mockAlbum as any)

    const client = createTestQueryClient()
    const TestComponent = defineComponent({
      props: { albumId: { type: Number, required: true } },
      setup(props) {
        const query = useAlbumQuery(toRef(props, 'albumId'))
        return { query }
      },
      template: '<div><span v-if="query.data.value">{{ query.data.value.title }}</span></div>',
    })

    const wrapper = mount(TestComponent, {
      props: { albumId: 456 },
      global: {
        provide: {
          [VUE_QUERY_CLIENT]: client,
        },
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Solaris Album')
    })
  })
})

describe('useLyricsQuery', () => {
  it('fetches lyrics through musicApi', async () => {
    vi.spyOn(musicApi, 'fetchLyricsBySongId').mockResolvedValue('[00:01.00] Echoes in time')

    const client = createTestQueryClient()
    const TestComponent = defineComponent({
      props: { songId: { type: String, required: true } },
      setup(props) {
        const query = useLyricsQuery(toRef(props, 'songId'))
        return { query }
      },
      template: '<div><span v-if="query.data.value">{{ query.data.value }}</span></div>',
    })

    const wrapper = mount(TestComponent, {
      props: { songId: '101' },
      global: {
        provide: {
          [VUE_QUERY_CLIENT]: client,
        },
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Echoes in time')
    })
  })
})

describe('useAlbumDetailQuery', () => {
  it('fetches album detail through musicApi', async () => {
    const mockAlbum = {
      id: '456',
      title: 'Solaris Full Album',
      entry_status: 'open',
      songs: [],
    }
    vi.spyOn(musicApi, 'fetchAlbumDetail').mockResolvedValue(mockAlbum as any)

    const client = createTestQueryClient()
    const TestComponent = defineComponent({
      props: { albumId: { type: String, required: true } },
      setup(props) {
        const query = useAlbumDetailQuery(toRef(props, 'albumId'))
        return { query }
      },
      template: '<div><span v-if="query.data.value">{{ query.data.value.title }}</span></div>',
    })

    const wrapper = mount(TestComponent, {
      props: { albumId: '456' },
      global: {
        provide: {
          [VUE_QUERY_CLIENT]: client,
        },
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Solaris Full Album')
    })
  })
})

describe('useArtistDetailQuery', () => {
  it('fetches artist detail through musicApi', async () => {
    const mockArtist = {
      id: '789',
      name: 'Solaris Band',
      entry_status: 'open',
    }
    vi.spyOn(musicApi, 'fetchArtistDetail').mockResolvedValue(mockArtist as any)

    const client = createTestQueryClient()
    const TestComponent = defineComponent({
      props: { artistId: { type: String, required: true } },
      setup(props) {
        const query = useArtistDetailQuery(toRef(props, 'artistId'))
        return { query }
      },
      template: '<div><span v-if="query.data.value">{{ query.data.value.name }}</span></div>',
    })

    const wrapper = mount(TestComponent, {
      props: { artistId: '789' },
      global: {
        provide: {
          [VUE_QUERY_CLIENT]: client,
        },
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Solaris Band')
    })
  })
})

describe('usePlaylistDetailQuery', () => {
  it('fetches playlist detail through musicApi', async () => {
    const mockPlaylist = {
      id: '999',
      name: 'Ambient Chill',
      songs: [],
      song_count: 0,
    }
    vi.spyOn(musicApi, 'fetchPlaylistDetail').mockResolvedValue(mockPlaylist as any)

    const client = createTestQueryClient()
    const TestComponent = defineComponent({
      props: { playlistId: { type: String, required: true } },
      setup(props) {
        const query = usePlaylistDetailQuery(toRef(props, 'playlistId'))
        return { query }
      },
      template: '<div><span v-if="query.data.value">{{ query.data.value.name }}</span></div>',
    })

    const wrapper = mount(TestComponent, {
      props: { playlistId: '999' },
      global: {
        provide: {
          [VUE_QUERY_CLIENT]: client,
        },
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Ambient Chill')
    })
  })
})


