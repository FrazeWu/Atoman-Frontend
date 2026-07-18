import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { moduleRoutes } from '@/router/routes/modules'
import PodcastEpisodeView from '@/views/podcast/PodcastEpisodeView.vue'

const makeJsonResponse = (data: unknown) => new Response(JSON.stringify(data), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

describe('podcast routing prefix', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('keeps podcast consumer routes and excludes old creator routes', () => {
    const paths = moduleRoutes.podcast.flatMap(route => [
      route.path,
      ...((route.children || []).map(child => child.path)),
    ])

    expect(paths).toContain('episode/:id')
    expect(paths).toContain('show/:channelSlug')
    expect(paths).not.toContain('editor')
    expect(paths).not.toContain('editor/:id')
    expect(paths).not.toContain('creator')
  })

  it('keeps episode channel links under the podcast consumer prefix', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => makeJsonResponse({
      id: 'episode-1',
      audio_url: 'https://cdn.example.com/audio.mp3',
      duration_sec: 60,
      season_number: 1,
      episode_number: 1,
      post: { title: '测试单集', content: '说明' },
      channel: { name: '频道', slug: 'demo-show' },
    })))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/podcasts/episode/:id', component: PodcastEpisodeView }],
    })
    await router.push('/podcasts/episode/episode-1')
    await router.isReady()

    const wrapper = mount(PodcastEpisodeView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('a[href="/podcasts/show/demo-show"]').exists()).toBe(true)
  })
})
