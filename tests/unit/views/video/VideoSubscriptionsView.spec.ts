import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import VideoSubscriptionsView from '@/views/video/VideoSubscriptionsView.vue'
import { useAuthStore } from '@/stores/auth'

const response = (data: unknown) => new Response(JSON.stringify(data), { status: 200 })

describe('VideoSubscriptionsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.isAuthenticated = true
    auth.token = 'token-1'
  })

  it('没有更新时仍保留频道和合集提醒设置', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/videos/subscriptions?')) return response({ data: [], meta: { page: 1, page_size: 20, total: 0, has_more: false } })
      if (url.endsWith('/videos/channel-bookmarks')) {
        return response({ data: [{ id: 'channel-sub-1', channel: { id: 'channel-1', name: '视频频道' } }] })
      }
      if (url.endsWith('/videos/collection-bookmarks')) {
        return response({ data: [{ id: 'collection-sub-1', collection: { id: 'collection-1', name: '视频合集' } }] })
      }
      if (url.endsWith('/content/notification-preferences')) {
        return response({ data: [{ source_type: 'internal_collection', source_id: 'collection-1', mode: 'all' }] })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(VideoSubscriptionsView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header />' },
          PEmpty: { props: ['title'], template: '<div>{{ title }}</div>' },
          ContentNotificationMode: { props: ['sourceType', 'sourceId'], template: '<span class="notification-mode">{{ sourceType }}:{{ sourceId }}</span>' },
          PaginationBar: true,
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('视频频道')
    expect(wrapper.text()).toContain('视频合集')
    expect(wrapper.text()).toContain('暂无订阅更新')
    expect(wrapper.findAll('.notification-mode')).toHaveLength(2)
    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/content/notification-preferences'))).toHaveLength(1)
    const subscriptionCall = fetchMock.mock.calls.find(([input]) => String(input).includes('/videos/subscriptions?'))
    expect(new Headers(subscriptionCall?.[1]?.headers).get('Authorization')).toBe('Bearer token-1')
  })
})
