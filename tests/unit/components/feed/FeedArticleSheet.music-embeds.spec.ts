import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'
import { usePlayerStore } from '@/stores/player'
import type { Song, TimelineItem } from '@/types'
import type { EmbedData } from '@/composables/useMarkdownRenderer'

const songId = '11111111-1111-1111-1111-111111111111'

const mockState = {
  postEmbeds: ref<Record<string, EmbedData>>({}),
  musicEmbeds: ref<Record<string, EmbedData>>({}),
  videoEmbeds: ref<Record<string, EmbedData>>({}),
  load: vi.fn(),
}

vi.mock('@/composables/useBlogMediaEmbeds', () => ({
  useBlogMediaEmbeds: () => mockState,
}))

const sampleSong: Song = {
  id: songId,
  title: 'Feed嵌入单曲',
  artist: 'Feed音乐人',
  album: 'Feed专辑',
  album_id: '22222222-2222-2222-2222-222222222222',
  audio_url: 'https://example.com/feed-audio.mp3',
  cover_url: 'https://example.com/cover.jpg',
  waveform_peaks: [10, 20, 30],
  duration_sec: 210,
  year: 2026,
  lyrics: '',
  status: 'open',
}

describe('FeedArticleSheet music embeds', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    mockState.postEmbeds.value = {}
    mockState.musicEmbeds.value = {}
    mockState.videoEmbeds.value = {}
    mockState.load.mockReset()
  })

  it('renders music embed card for blog post and clicking play triggers player and expands player', async () => {
    mockState.musicEmbeds.value = {
      [songId]: {
        id: songId,
        kind: 'song',
        title: 'Feed嵌入单曲',
        summary: '来自博文的音乐引用',
        meta: 'Feed音乐人 · 3:30',
        imageUrl: 'https://example.com/cover.jpg',
        href: `/music/song/${songId}`,
        playbackSongs: [sampleSong],
      },
    }

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/music/song/:id', component: { template: '<div>Song</div>' } },
      ],
    })
    await router.push('/')

    const player = usePlayerStore()
    const playSongSpy = vi.spyOn(player, 'playSong').mockImplementation(() => {})
    const expandPlayerSpy = vi.spyOn(player, 'expandPlayer')

    const article: TimelineItem = {
      type: 'post',
      published_at: '2026-07-01T00:00:00Z',
      is_read: true,
      post: {
        id: 'post-1',
        user_id: 'u1',
        title: '博客动态分享',
        summary: '摘要',
        content: `这是一篇包含音乐引用的动态：\n\n:::music{id="${songId}"}:::\n\n请欣赏！`,
        status: 'published',
        rating_score: 5,
        rating_count: 1,
        created_at: '2026-07-01T00:00:00Z',
      },
    }

    const wrapper = mount(FeedArticleSheet, {
      props: {
        show: true,
        article,
      },
      global: {
        plugins: [pinia, router],
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
          PButton: true,
          PLink: true,
          PSegmentedControl: true,
          PDiscussionFAB: true,
          PostRatingControl: true,
          BlogPostUpdateNotice: true,
          CommentSideSheet: true,
        },
      },
    })

    await flushPromises()

    expect(mockState.load).toHaveBeenCalledWith(
      expect.stringContaining(`:::music{id="${songId}"}:::`),
      undefined,
    )

    const playBtn = wrapper.find('[data-atoman-embed-play="music"]')
    expect(playBtn.exists()).toBe(true)
    expect(playBtn.attributes('data-atoman-embed-id')).toBe(songId)

    await playBtn.trigger('click')
    expect(playSongSpy).toHaveBeenCalledWith(sampleSong)
    expect(expandPlayerSpy).toHaveBeenCalled()
  })

  it('clicking music embed link in feed article navigates to music route', async () => {
    mockState.musicEmbeds.value = {
      [songId]: {
        id: songId,
        kind: 'song',
        title: 'Feed嵌入单曲',
        href: `/music/song/${songId}`,
        playbackSongs: [sampleSong],
      },
    }

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/music/song/:id', component: { template: '<div>Song Target</div>' } },
      ],
    })
    await router.push('/')

    const article: TimelineItem = {
      type: 'post',
      published_at: '2026-07-01T00:00:00Z',
      is_read: true,
      post: {
        id: 'post-1',
        user_id: 'u1',
        title: '博客动态分享',
        summary: '摘要',
        content: `这是一篇包含音乐引用的动态：\n\n:::music{id="${songId}"}:::\n\n请欣赏！`,
        status: 'published',
        created_at: '2026-07-01T00:00:00Z',
      },
    }

    const wrapper = mount(FeedArticleSheet, {
      props: {
        show: true,
        article,
      },
      global: {
        plugins: [pinia, router],
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
          PButton: true,
          PLink: true,
          PSegmentedControl: true,
          PDiscussionFAB: true,
          PostRatingControl: true,
          BlogPostUpdateNotice: true,
          CommentSideSheet: true,
        },
      },
    })

    await flushPromises()

    const link = wrapper.find('a[data-atoman-embed="music"]')
    expect(link.exists()).toBe(true)

    await link.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe(`/music/song/${songId}`)
  })
})
