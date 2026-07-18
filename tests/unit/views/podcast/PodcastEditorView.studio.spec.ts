import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PodcastEditorView from '@/views/podcast/PodcastEditorView.vue'
import { useAuthStore } from '@/stores/auth'
import { useStudioStore } from '@/stores/studio'

const makeJsonResponse = (data: unknown) => new Response(JSON.stringify(data), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

async function setup(path = '/studio/podcast/new?collection=collection-2') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/studio/podcast/new', component: PodcastEditorView },
      { path: '/studio/podcast/:id/edit', component: PodcastEditorView },
      { path: '/studio/podcast/content', component: { template: '<div />' } },
      { path: '/podcasts/episode/:id', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
  const auth = useAuthStore(pinia)
  auth.isAuthenticated = true
  auth.token = 'token'
  auth.user = { id: 'user-1', uuid: 'user-1', username: 'demo', role: 'user' } as never
  const studio = useStudioStore(pinia)
  studio.loaded = true
  studio.channels = [
    { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' },
    { id: 'channel-2', name: '旧内容频道', slug: 'legacy', description: '', cover_url: '' },
  ]
  studio.currentChannel = studio.channels[0]
  studio.collections.podcast = [
    { id: 'collection-1', channel_id: 'channel-1', content_type: 'podcast', name: '默认合集', description: '', cover_url: '', is_default: true, created_at: '', updated_at: '' },
    { id: 'collection-2', channel_id: 'channel-1', content_type: 'podcast', name: '专题', description: '', cover_url: '', is_default: false, created_at: '', updated_at: '' },
  ]
  studio.settings.podcast = {
    channel_id: 'channel-1', module: 'podcast', default_collection_id: null,
    default_visibility: 'public', default_publish_status: 'published', autoplay_enabled: false,
  }
  const wrapper = mount(PodcastEditorView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, router, studio }
}

describe('PodcastEditorView Studio integration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/podcast/creator/settings')) return makeJsonResponse({ data: {} })
      if (url.includes('/users/me/default-channels')) return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })
      if (url.includes('/blog/channels?')) return makeJsonResponse({ data: [] })
      if (url.endsWith('/podcast/episodes') && init?.method === 'POST') return makeJsonResponse({ id: 'episode-1' })
      throw new Error(`unexpected fetch: ${url}`)
    }))
  })

  it('uses the Studio current channel without rendering a channel picker and preselects collection query', async () => {
    const { wrapper } = await setup()
    expect(wrapper.vm.$.setupState.form.channel_id).toBe('channel-1')
    expect(wrapper.vm.$.setupState.selectedCollectionId).toBe('collection-2')
    expect(wrapper.text()).not.toContain('节目频道 *')
    expect(wrapper.find('.pe-default-channel-row').exists()).toBe(false)
  })

  it('keeps the media information and publish steps inside Studio', async () => {
    const { wrapper } = await setup()
    expect(wrapper.get('[aria-current="step"]').text()).toContain('媒体')

    wrapper.vm.$.setupState.form.audio_url = 'https://cdn.example.com/audio.mp3'
    await wrapper.get('[data-testid="creator-next"]').trigger('click')
    expect(wrapper.get('[aria-current="step"]').text()).toContain('信息')

    wrapper.vm.$.setupState.form.title = '三步播客'
    await wrapper.get('[data-testid="creator-next"]').trigger('click')
    expect(wrapper.get('[aria-current="step"]').text()).toContain('发布')
    expect(wrapper.get('.pe-review').text()).toContain('三步播客')
  })

  it('saves a draft without a collection and returns to content management', async () => {
    const { wrapper, router } = await setup('/studio/podcast/new')
    const form = wrapper.vm.$.setupState.form as { title: string; audio_url: string }
    form.title = '测试单集'
    form.audio_url = 'https://cdn.example.com/audio.mp3'
    wrapper.vm.$.setupState.uploadStarted = true
    wrapper.vm.$.setupState.selectedCollectionId = ''

    await wrapper.vm.$.setupState.saveDraft()
    await flushPromises()

    const fetchMock = vi.mocked(fetch)
    const postCall = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith('/podcast/episodes') && init?.method === 'POST')
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({ channel_id: 'channel-1', collection_ids: [], status: 'draft' })
    expect(router.currentRoute.value.fullPath).toBe('/studio/podcast/content')
  })

  it('requires a collection before publishing', async () => {
    const { wrapper } = await setup('/studio/podcast/new')
    const form = wrapper.vm.$.setupState.form as { title: string; audio_url: string }
    form.title = '测试单集'
    form.audio_url = 'https://cdn.example.com/audio.mp3'
    wrapper.vm.$.setupState.uploadStarted = true
    wrapper.vm.$.setupState.selectedCollectionId = ''

    await wrapper.get('[data-testid="creator-next"]').trigger('click')
    await wrapper.get('[data-testid="creator-next"]').trigger('click')

    wrapper.vm.$.setupState.requestPublish()
    await flushPromises()

    expect(wrapper.text()).toContain('请先选择合集')
    expect(wrapper.vm.$.setupState.showPublishConfirm).toBe(false)
  })

  it('switches Studio state to an edited episodes channel before loading collections', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/podcast/episodes/episode-1')) {
        return makeJsonResponse({
          id: 'episode-1', channel_id: 'channel-2', audio_url: 'https://cdn.example.com/audio.mp3',
          episode_cover_url: '', season_number: 1, episode_number: 1,
          post: { title: '旧单集', content: '', visibility: 'public', collections: [] }, collections: [],
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))
    const { studio } = await setup('/studio/podcast/episode-1/edit')
    expect(studio.selectChannel).toHaveBeenCalledWith('channel-2')
    expect(studio.loadCollections).toHaveBeenCalledWith('podcast')
  })
})
