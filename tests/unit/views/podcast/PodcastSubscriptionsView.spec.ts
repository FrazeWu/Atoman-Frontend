import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ModuleSubscriptionSourcesPicker from '@/components/feed/ModuleSubscriptionSourcesPicker.vue'
import PodcastSubscriptionsView from '@/views/podcast/PodcastSubscriptionsView.vue'
import { useAuthStore } from '@/stores/auth'

const response = (data: unknown) => new Response(JSON.stringify(data), { status: 200 })

describe('PodcastSubscriptionsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.isAuthenticated = true
    auth.token = 'token-1'
    localStorage.clear()
  })

  it('按路由上下文通过统一接口加载播客更新', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/feed/subscription-hub/tree')) {
        return response({ data: { types: [] } })
      }
      if (url.includes('/feed/subscription-hub/updates')) {
        return response({
          data: [{
            type: 'podcast_episode',
            podcast_episode: {
              id: 'episode-1',
              audio_url: 'https://cdn.example.com/episode.mp3',
              duration_sec: 600,
              post: { title: '筛选后的单集' },
              channel: { name: '原子谈话' },
            },
          }],
          meta: { page: 1, page_size: 20, total: 1, has_more: false },
        })
      }
      if (url.includes('/music/playback-session') || url.includes('/music/playback-progress')) {
        return response({ data: null })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/podcasts/subscriptions', component: PodcastSubscriptionsView },
        { path: '/podcasts/episode/:id', component: { template: '<div />' } },
      ],
    })
    await router.push('/podcasts/subscriptions?hub_group_id=podcast-group&hub_membership_id=podcast-member')
    await router.isReady()

    const wrapper = mount(PodcastSubscriptionsView, {
      global: {
        plugins: [router],
        stubs: {
          PPageHeader: { template: '<header />' },
          PEmpty: { props: ['title'], template: '<div>{{ title }}</div>' },
          PButton: { template: '<button><slot /></button>' },
        },
      },
    })
    await flushPromises()

    const updatesRequest = fetchMock.mock.calls.find(([input]) => String(input).includes('/feed/subscription-hub/updates'))
    expect(String(updatesRequest?.[0])).toContain('type=podcast')
    expect(String(updatesRequest?.[0])).toContain('group_id=podcast-group')
    expect(String(updatesRequest?.[0])).toContain('membership_id=podcast-member')
    expect(wrapper.text()).toContain('筛选后的单集')
    expect(wrapper.find('.psub-sources').exists()).toBe(false)
    const picker = wrapper.findComponent(ModuleSubscriptionSourcesPicker)
    expect(picker.exists()).toBe(true)
    expect(picker.props()).toMatchObject({
      subscriptionType: 'podcast',
      subscriptionPath: '/podcasts/subscriptions',
    })
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/podcast/show-bookmarks'))).toBe(false)
  })
})
