import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TimelineHomeView from '@/views/timeline/TimelineHomeView.vue'

const event = {
  id: 'event-123',
  user_id: 'user-1',
  title: '被推荐的历史事件',
  description: '事件摘要',
  content: '',
  event_date: '2026-07-18T00:00:00Z',
  location: 'Berlin',
  source: 'Archive',
  category: '历史',
  tags: [],
  is_public: true,
}

describe('TimelineHomeView resource link', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('opens the event selected by the event query parameter', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('/timeline/events/event-123')) {
        return new Response(JSON.stringify({ data: event }), { status: 200 })
      }
      if (url.includes('/timeline/events?')) {
        return new Response(JSON.stringify({ data: [], total: 0, page: 1, limit: 200 }), { status: 200 })
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/timeline', component: TimelineHomeView }],
    })
    await router.push('/timeline?event=event-123')
    await router.isReady()

    const wrapper = mount(TimelineHomeView, {
      global: {
        plugins: [router],
        stubs: {
          PModal: { template: '<div data-testid="event-detail"><slot /></div>' },
          TimelineRevisionProposal: true,
          PDiscussionFAB: true,
          TimelineLocationEditor: true,
        },
      },
    })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/timeline/events/event-123')
    expect(wrapper.get('[data-testid="event-detail"]').text()).toContain('被推荐的历史事件')
  })
})
