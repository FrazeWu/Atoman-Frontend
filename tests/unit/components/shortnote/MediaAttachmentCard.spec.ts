import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MediaAttachmentCard from '@/components/shortnote/MediaAttachmentCard.vue'
import type { ShortNoteMediaAttachment } from '@/types'

const playerMock = vi.hoisted(() => ({
  playSong: vi.fn(),
  playAlbum: vi.fn(),
  togglePlay: vi.fn(),
  currentSong: null as unknown,
  currentAlbum: null as unknown,
  isPlaying: false,
}))

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => playerMock,
}))

const apiMocks = vi.hoisted(() => ({
  getMusicAlbum: vi.fn(),
  getVideo: vi.fn(),
  routerPush: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  getMusicAlbum: (...args: unknown[]) => apiMocks.getMusicAlbum(...args),
}))

vi.mock('@/api/video', () => ({
  getVideo: (...args: unknown[]) => apiMocks.getVideo(...args),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: apiMocks.routerPush,
  }),
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a :href="to" data-test="router-link"><slot /></a>',
  },
}))

let pinia = createPinia()

function mountCard(component: any, options: any = {}) {
  return mount(component, {
    ...options,
    global: {
      plugins: [pinia],
      ...options.global,
    },
  })
}

describe('MediaAttachmentCard', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
    playerMock.currentSong = null
    playerMock.currentAlbum = null
    playerMock.isPlaying = false
  })

  const songAttachment: ShortNoteMediaAttachment = {
    type: 'song',
    id: 'song-test-1',
    title: '夜曲',
    subtitle: '周杰伦',
    cover_url: 'https://example.com/cover.jpg',
    audio_url: 'https://example.com/song.mp3',
    duration: 220,
  }

  const albumAttachment: ShortNoteMediaAttachment = {
    type: 'album',
    id: 'album-test-1',
    title: '十一月的萧邦',
    subtitle: '周杰伦 · 2005',
    cover_url: 'https://example.com/album-cover.jpg',
  }

  const videoAttachment: ShortNoteMediaAttachment = {
    type: 'video',
    id: 'video-test-1',
    title: '夜曲 MV',
    subtitle: '04:15',
    cover_url: 'https://example.com/video-poster.jpg',
    duration: 255,
  }

  it('渲染单曲卡片：显示标题、艺术家、封面', () => {
    const wrapper = mountCard(MediaAttachmentCard, {
      props: { attachment: songAttachment },
    })

    expect(wrapper.text()).toContain('夜曲')
    expect(wrapper.text()).toContain('周杰伦')
    const img = wrapper.find('.media-attachment-card__cover img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/cover.jpg')
    expect(img.attributes('alt')).toBe('夜曲')
  })

  it('点击「播放」按钮：验证调用 usePlayerStore().playSong', async () => {
    const wrapper = mountCard(MediaAttachmentCard, {
      props: { attachment: songAttachment },
    })

    const playBtn = wrapper.find('[data-test="media-play-btn"]')
    expect(playBtn.exists()).toBe(true)

    await playBtn.trigger('click')

    expect(playerMock.playSong).toHaveBeenCalledTimes(1)
    expect(playerMock.playSong).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'song-test-1',
        title: '夜曲',
        artist: '周杰伦',
        audio_url: 'https://example.com/song.mp3',
      }),
    )
  })

  it('正在播放当前单曲时：显示暂停状态并支持切歌/切换播放', async () => {
    playerMock.currentSong = { id: 'song-test-1', title: '夜曲' } as never
    playerMock.isPlaying = true

    const wrapper = mountCard(MediaAttachmentCard, {
      props: { attachment: songAttachment },
    })

    const playBtn = wrapper.find('[data-test="media-play-btn"]')
    expect(playBtn.attributes('aria-label')).toBe('暂停')
    expect(wrapper.classes()).toContain('is-playing')

    await playBtn.trigger('click')
    expect(playerMock.togglePlay).toHaveBeenCalledTimes(1)
  })

  it('渲染专辑卡片并点击播放：通过 getMusicAlbum 加载曲目并调用 playAlbum', async () => {
    apiMocks.getMusicAlbum.mockResolvedValue({
      id: 'album-test-1',
      title: '十一月的萧邦',
      artists: [{ id: 'artist-1', name: '周杰伦' }],
      songs: [
        {
          id: 'song-1',
          title: '夜曲',
          audio_url: 'https://example.com/track1.mp3',
          audio_status: 'ready',
        },
        {
          id: 'song-2',
          title: '蓝色风暴',
          audio_url: 'https://example.com/track2.mp3',
          audio_status: 'ready',
        },
      ],
    })

    const wrapper = mountCard(MediaAttachmentCard, {
      props: { attachment: albumAttachment },
    })

    expect(wrapper.text()).toContain('十一月的萧邦')
    expect(wrapper.text()).toContain('周杰伦 · 2005')

    const playBtn = wrapper.find('[data-test="media-play-btn"]')
    await playBtn.trigger('click')
    await flushPromises()

    expect(apiMocks.getMusicAlbum).toHaveBeenCalledWith('album-test-1')
    expect(playerMock.playAlbum).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'song-1', title: '夜曲' }),
        expect.objectContaining({ id: 'song-2', title: '蓝色风暴' }),
      ]),
    )
  })

  it('渲染视频卡片：支持展开内嵌播放或外跳至详情页', async () => {
    apiMocks.getVideo.mockResolvedValue({
      id: 'video-test-1',
      title: '夜曲 MV',
      video_url: 'https://example.com/video.mp4',
    })

    const wrapper = mountCard(MediaAttachmentCard, {
      props: { attachment: videoAttachment },
    })

    expect(wrapper.text()).toContain('夜曲 MV')
    expect(wrapper.text()).toContain('04:15')

    // 存在跳转链接
    const link = wrapper.find('a[href="/videos/watch/video-test-1"]')
    expect(link.exists()).toBe(true)

    // 点击播放按钮内嵌展开
    const playBtn = wrapper.find('[data-test="media-play-btn"]')
    await playBtn.trigger('click')
    await flushPromises()

    expect(apiMocks.getVideo).toHaveBeenCalledWith('video-test-1', undefined)
    const video = wrapper.find('video')
    expect(video.exists()).toBe(true)
    expect(video.attributes('src')).toBe('https://example.com/video.mp4')
  })

  it('点击卡片任意区域：阻止向父容器触发事件冒泡', async () => {
    const parentClickHandler = vi.fn()
    const ParentComponent = {
      components: { MediaAttachmentCard },
      props: ['attachment'],
      template: `
        <div class="parent-container" @click="handleParentClick">
          <MediaAttachmentCard :attachment="attachment" />
        </div>
      `,
      methods: {
        handleParentClick: parentClickHandler,
      },
    }

    const wrapper = mountCard(ParentComponent, {
      props: { attachment: songAttachment },
    })

    // 点击卡片根节点
    await wrapper.findComponent(MediaAttachmentCard).trigger('click')
    expect(parentClickHandler).not.toHaveBeenCalled()

    // 点击卡片内部播放按钮
    await wrapper.find('[data-test="media-play-btn"]').trigger('click')
    expect(parentClickHandler).not.toHaveBeenCalled()
  })
})
