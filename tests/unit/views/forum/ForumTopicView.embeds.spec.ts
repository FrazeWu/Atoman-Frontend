import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import ForumTopicView from '@/views/forum/ForumTopicView.vue'
import { useAuthStore } from '@/stores/auth'
import { useForumStore } from '@/stores/forum'
import { usePlayerStore } from '@/stores/player'
import type { ForumCategory, ForumTopic, Song } from '@/types'
import type { EmbedData } from '@/composables/useMarkdownRenderer'

const mockState = {
  postEmbeds: ref<Record<string, EmbedData>>({}),
  musicEmbeds: ref<Record<string, EmbedData>>({}),
  videoEmbeds: ref<Record<string, EmbedData>>({}),
  load: vi.fn(),
}

vi.mock('@/composables/useBlogMediaEmbeds', () => ({
  useBlogMediaEmbeds: () => mockState,
}))

vi.mock('@/composables/useInteractions', () => ({
  useInteractions: () => ({
    comments: { value: [] },
    likeCount: { value: 0 },
    commentCount: { value: 0 },
    liked: { value: false },
    loadingComments: { value: false },
    submittingComment: { value: false },
    like: vi.fn(),
    unlike: vi.fn(),
    fetchComments: vi.fn(),
    createComment: vi.fn(),
    deleteComment: vi.fn(),
  }),
}))

const songId = '11111111-1111-1111-1111-111111111111'

const sampleSong: Song = {
  id: songId,
  title: '测试曲目',
  artist: '测试艺术家',
  album: '测试专辑',
  album_id: '22222222-2222-2222-2222-222222222222',
  audio_url: 'https://example.com/audio.mp3',
  cover_url: 'https://example.com/cover.jpg',
  waveform_peaks: [10, 20, 30],
  duration_sec: 180,
  year: 2026,
  lyrics: '',
  status: 'open',
}

const forumCategory: ForumCategory = {
  id: 'cat-1',
  name: '音乐交流',
  color: '#0055ff',
  created_at: '2026-07-07T00:00:00Z',
}

const makeTopicWithMusic = (): ForumTopic => ({
  id: 'topic-music-1',
  user_id: 'user-1',
  category_id: forumCategory.id,
  category: forumCategory,
  title: '分享一首好听的歌',
  content: `大家听听这首歌：\n\n:::music{id="${songId}"}:::\n\n很赞吧！`,
  tags: ['音乐'],
  pinned: false,
  featured: false,
  closed: false,
  reply_count: 0,
  like_count: 5,
  view_count: 20,
  is_liked: false,
  is_bookmarked: false,
  created_at: '2026-07-07T00:00:00Z',
  updated_at: '2026-07-07T00:00:00Z',
})

describe('ForumTopicView music embed interactions', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    mockState.postEmbeds.value = {}
    mockState.musicEmbeds.value = {}
    mockState.videoEmbeds.value = {}
    mockState.load.mockReset()
  })

  it('renders music embed card and clicking play triggers player.playSong and player.expandPlayer', async () => {
    mockState.musicEmbeds.value = {
      [songId]: {
        id: songId,
        kind: 'song',
        title: '测试曲目',
        summary: '一首好听的歌',
        meta: '测试艺术家 · 3:00',
        imageUrl: 'https://example.com/cover.jpg',
        href: `/music/song/${songId}`,
        playbackSongs: [sampleSong],
      },
    }

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/forum/topic/:id', component: ForumTopicView },
        { path: '/music/song/:id', component: { template: '<div>Song</div>' } },
      ],
    })
    await router.push('/forum/topic/topic-music-1')

    const authStore = useAuthStore()
    authStore.isAuthenticated = false
    authStore.token = ''

    const topic = makeTopicWithMusic()
    const forumStore = useForumStore()
    forumStore.loading = false
    forumStore.currentTopic = topic
    vi.spyOn(forumStore, 'fetchTopic').mockResolvedValue(topic)

    const player = usePlayerStore()
    const playSongSpy = vi.spyOn(player, 'playSong').mockImplementation(() => {})
    const expandPlayerSpy = vi.spyOn(player, 'expandPlayer')

    const wrapper = mount(ForumTopicView, {
      global: {
        plugins: [pinia, router],
        stubs: {
          CommentSideSheet: true,
          PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
          PButton: { template: '<button><slot /></button>' },
          InteractionBar: true,
          RouterLink: true,
        },
      },
    })
    await flushPromises()

    expect(mockState.load).toHaveBeenCalledWith(
      expect.stringContaining(`:::music{id="${songId}"}:::`),
      undefined,
    )

    // Check rendered music card
    const playBtn = wrapper.find('[data-atoman-embed-play="music"]')
    expect(playBtn.exists()).toBe(true)
    expect(playBtn.attributes('data-atoman-embed-id')).toBe(songId)

    // Click play button
    await playBtn.trigger('click')
    expect(playSongSpy).toHaveBeenCalledWith(sampleSong)
    expect(expandPlayerSpy).toHaveBeenCalled()
  })

  it('clicking music embed link navigates to the music song page', async () => {
    mockState.musicEmbeds.value = {
      [songId]: {
        id: songId,
        kind: 'song',
        title: '测试曲目',
        href: `/music/song/${songId}`,
        playbackSongs: [sampleSong],
      },
    }

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/forum/topic/:id', component: ForumTopicView },
        { path: '/music/song/:id', component: { template: '<div>Song Target</div>' } },
      ],
    })
    await router.push('/forum/topic/topic-music-1')

    const authStore = useAuthStore()
    authStore.isAuthenticated = false
    authStore.token = ''

    const topic = makeTopicWithMusic()
    const forumStore = useForumStore()
    forumStore.loading = false
    forumStore.currentTopic = topic
    vi.spyOn(forumStore, 'fetchTopic').mockResolvedValue(topic)

    const wrapper = mount(ForumTopicView, {
      global: {
        plugins: [pinia, router],
        stubs: {
          CommentSideSheet: true,
          PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
          PButton: { template: '<button><slot /></button>' },
          InteractionBar: true,
          RouterLink: true,
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
