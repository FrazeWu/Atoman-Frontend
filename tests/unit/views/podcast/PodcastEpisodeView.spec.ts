import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import CommentSection from '@/components/comment/CommentSection.vue'
import PodcastEpisodeView from '@/views/podcast/PodcastEpisodeView.vue'

vi.mock('@/components/comment/CommentSection.vue', () => ({
  default: { name: 'CommentSection', props: ['target', 'currentTime'], emits: ['seek'], template: '<section />' },
}))

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
})
