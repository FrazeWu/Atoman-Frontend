import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Song, Video } from '@/types'

const playerMock = vi.hoisted(() => ({
  playAlbum: vi.fn(),
  playSong: vi.fn(),
}))

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => playerMock,
}))

import BlogMediaContent from '@/components/blog/BlogMediaContent.vue'
import BlogMediaEmbed from '@/components/blog/BlogMediaEmbed.vue'
import PVideoPlayerShell from '@/components/shared/PVideoPlayerShell.vue'
import VideoPlayerControls from '@/components/video/VideoPlayerControls.vue'

const song = {
  id: 'song-1',
  title: '单曲',
  artist: '歌手',
  album: '专辑',
  album_id: 'album-1',
  year: 2026,
  release_date: '',
  lyrics: '',
  audio_url: '/song.mp3',
  cover_url: '/cover.jpg',
  status: 'open',
} as Song

const video = {
  id: 'video-1',
  title: '视频',
  description: '',
  storage_type: 'local',
  video_url: '/video.mp4',
  thumbnail_url: '/poster.jpg',
  duration_sec: 30,
} as Video

describe('BlogMediaContent', () => {
  afterEach(() => {
    playerMock.playAlbum.mockReset()
    playerMock.playSong.mockReset()
  })

  it('plays a single or an album through the global player', async () => {
    const wrapper = mount(BlogMediaContent, {
      props: {
        html: '<button data-atoman-embed-play="music" data-atoman-embed-id="song-1">播放</button><button data-atoman-embed-play="music" data-atoman-embed-id="album-1">播放</button>',
        musicEmbeds: {
          'song-1': { id: 'song-1', title: '单曲', kind: 'song', playbackSongs: [song] },
          'album-1': { id: 'album-1', title: '专辑', kind: 'album', playbackSongs: [song, { ...song, id: 'song-2' }] },
        },
        videoEmbeds: {},
      },
    })

    await wrapper.find('[data-atoman-embed-id="song-1"]').trigger('click')
    await wrapper.find('[data-atoman-embed-id="album-1"]').trigger('click')

    expect(playerMock.playSong).toHaveBeenCalledWith(song)
    expect(playerMock.playAlbum).toHaveBeenCalledWith([
      song,
      { ...song, id: 'song-2' },
    ])
  })

  it('mounts the existing video shell and controls for local videos', async () => {
    const wrapper = mount(BlogMediaContent, {
      props: {
        html: '<div data-atoman-video-embed="video-1"></div>',
        musicEmbeds: {},
        videoEmbeds: {
          'video-1': {
            id: 'video-1',
            title: '视频',
            kind: 'video',
            videoSrc: '/video.mp4',
            posterUrl: '/poster.jpg',
            duration: 30,
            video,
          },
        },
      },
    })

    await nextTick()

    expect(wrapper.find('.vps-shell').exists()).toBe(true)
    expect(wrapper.find('.vpc').exists()).toBe(true)
    expect(wrapper.find('video').attributes('src')).toBe('/video.mp4')
  })

  it('uses the existing player components for a direct video embed', () => {
    const wrapper = mount(BlogMediaEmbed, {
      props: {
        embed: {
          id: 'video-1',
          title: '视频',
          kind: 'video',
          videoSrc: '/video.mp4',
          duration: 30,
          video,
        },
      },
    })

    expect(wrapper.findComponent(PVideoPlayerShell).exists()).toBe(true)
    expect(wrapper.findComponent(VideoPlayerControls).exists()).toBe(true)
  })

  it('does not mount a player for an unknown video embed', async () => {
    const wrapper = mount(BlogMediaContent, {
      props: {
        html: '<div data-atoman-video-embed="missing"></div>',
        musicEmbeds: {},
        videoEmbeds: {},
      },
    })

    await nextTick()

    expect(wrapper.find('.vps-shell').exists()).toBe(false)
  })
})
