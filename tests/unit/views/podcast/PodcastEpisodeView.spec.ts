import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import CommentSection from '@/components/comment/CommentSection.vue'
import PodcastEpisodeView from '@/views/podcast/PodcastEpisodeView.vue'

vi.mock('@/components/comment/CommentSection.vue', () => ({
  default: { name: 'CommentSection', props: ['target', 'currentTime'], emits: ['seek'], template: '<section />' },
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

const episodeResponse = (id: string, title: string) => new Response(JSON.stringify({
  id,
  audio_url: `https://example.com/${id}.mp3`,
  duration_sec: 600,
  season_number: 1,
  episode_number: 1,
  post: { title },
}), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('PodcastEpisodeView comments', () => {
  it('connects podcast episode comments to the audio player', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'episode-1',
      audio_url: 'https://example.com/episode.mp3',
      duration_sec: 600,
      season_number: 1,
      episode_number: 2,
      post: { title: '单集标题', content: '节目说明' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/podcasts/episode/:id', component: PodcastEpisodeView }],
    })
    await router.push('/podcasts/episode/episode-1')
    const wrapper = mount(PodcastEpisodeView, {
      global: {
        plugins: [router],
        stubs: {
          CommentSection: { name: 'CommentSection', props: ['target', 'currentTime'], emits: ['seek'], template: '<section />' },
        },
      },
    })
    await flushPromises()

    const comments = wrapper.findComponent(CommentSection)
    expect(comments.props('target')).toEqual({ kind: 'podcast_episode', resourceId: 'episode-1' })
    const audio = wrapper.get('audio').element as HTMLAudioElement
    Object.defineProperty(audio, 'currentTime', { value: 31, writable: true })
    audio.play = vi.fn().mockResolvedValue(undefined)
    expect(comments.props('currentTime')()).toBe(31)
    comments.vm.$emit('seek', 95)
    await flushPromises()
    expect(audio.currentTime).toBe(95)
  })

  it('keeps the latest route episode when responses complete out of order', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => (
      String(input).endsWith('/episode-a') ? first.promise : second.promise
    )))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/podcasts/episode/:id', component: PodcastEpisodeView }],
    })
    await router.push('/podcasts/episode/episode-a')
    const wrapper = mount(PodcastEpisodeView, {
      global: {
        plugins: [router],
        stubs: { CommentSection: { name: 'CommentSection', props: ['target', 'currentTime'], template: '<section />' } },
      },
    })

    await router.push('/podcasts/episode/episode-b')
    second.resolve(episodeResponse('episode-b', '当前单集'))
    await flushPromises()
    expect(wrapper.findComponent(CommentSection).props('target')).toEqual({ kind: 'podcast_episode', resourceId: 'episode-b' })

    first.resolve(episodeResponse('episode-a', '过期单集'))
    await flushPromises()
    expect(wrapper.text()).toContain('当前单集')
    expect(wrapper.text()).not.toContain('过期单集')
  })
})
