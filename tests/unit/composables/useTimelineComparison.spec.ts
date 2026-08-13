import { computed, defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTimelineComparison } from '@/composables/timeline/useTimelineComparison'
import type { TimelineEvent } from '@/types'

const event = (id: string, title: string): TimelineEvent => ({
  id,
  user_id: 'user-1',
  title,
  description: '',
  content: '',
  event_date: '2026-07-18T00:00:00Z',
  location: 'Berlin',
  source: 'Archive',
  category: '历史',
  tags: [],
  is_public: true,
})

describe('useTimelineComparison', () => {
  afterEach(() => vi.restoreAllMocks())

  it('restores the comparison from the route, hydrates missing events, and writes changes back', async () => {
    const localEvent = event('event-a', '本地事件')
    const remoteEvent = event('event-b', '补载事件')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: remoteEvent }), { status: 200 }),
    )
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/timeline', component: { template: '<div />' } }],
    })
    await router.push('/timeline?mode=map&compare=event-a,event-b')
    await router.isReady()

    const sortedEvents = ref<TimelineEvent[]>([localEvent])
    let comparison!: ReturnType<typeof useTimelineComparison>
    const Harness = defineComponent({
      setup() {
        comparison = useTimelineComparison({ sortedEvents: computed(() => sortedEvents.value) })
        return () => null
      },
    })
    const wrapper = mount(Harness, { global: { plugins: [router] } })
    await flushPromises()

    expect(comparison.viewMode.value).toBe('map')
    expect(comparison.compareIds.value).toEqual(['event-a', 'event-b'])
    expect(comparison.compareEvents.value.map(({ id }) => id)).toEqual(['event-a', 'event-b'])
    expect(comparison.activeCompareId.value).toBe('event-b')
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/timeline/events/event-b', { credentials: 'include' })

    comparison.removeCompareId('event-a')
    comparison.viewMode.value = 'lanes'
    await flushPromises()

    expect(router.currentRoute.value.query).toMatchObject({ compare: 'event-b' })
    expect(router.currentRoute.value.query.mode).toBeUndefined()
    wrapper.unmount()
  })
})
