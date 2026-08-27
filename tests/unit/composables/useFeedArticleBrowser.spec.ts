import { computed, defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useFeedArticleBrowser } from '@/composables/feed/useFeedArticleBrowser'
import type { TimelineItem } from '@/types'

vi.mock('@/utils/appRuntime', () => ({
  isStandaloneMobileApp: () => false,
}))

function deferredResponse(body: unknown) {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>((res) => {
    resolve = res
  })
  return {
    promise,
    resolve: () => resolve(new Response(JSON.stringify(body), { status: 200 })),
  }
}

const createFeedItem = (id: string, sourceId: string, title: string): TimelineItem => ({
  type: 'feed_item',
  feed_item: {
    id,
    feed_source_id: sourceId,
    feed_source: {
      id: sourceId,
      title,
    },
  },
  published_at: '2026-07-19T00:00:00Z',
  is_read: false,
} as TimelineItem)

describe('useFeedArticleBrowser', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('快速切换来源时忽略过期请求结果', async () => {
    setActivePinia(createPinia())

    const sourceAItem = createFeedItem('item-a', 'source-a', '来源 A')
    const sourceBItem = createFeedItem('item-b', 'source-b', '来源 B')
    const sourceAResponse = deferredResponse({ data: [sourceAItem] })
    const sourceBResponse = deferredResponse({ data: [sourceBItem] })

    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('feed_source_id=source-a')) return sourceAResponse.promise
      if (url.includes('feed_source_id=source-b')) return sourceBResponse.promise
      throw new Error(`unexpected url: ${url}`)
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })
    await router.push('/')
    await router.isReady()

    const timeline = ref<TimelineItem[]>([])
    let browser!: ReturnType<typeof useFeedArticleBrowser>
    const Harness = defineComponent({
      setup() {
        browser = useFeedArticleBrowser({
          visibleTimeline: computed(() => timeline.value),
          subscriptions: computed(() => []),
          focusedIndex: ref(-1),
          itemKey: (item) => item.feed_item?.id || item.post?.id || item.published_at || '',
          feedItemActionIDs: (item) => [item.id],
        })
        return () => null
      },
    })

    const wrapper = mount(Harness, {
      global: {
        plugins: [router],
      },
    })

    const firstOpen = browser.openFeedItemSourceSheet(sourceAItem.feed_item!)
    const secondOpen = browser.openFeedItemSourceSheet(sourceBItem.feed_item!)

    expect(browser.selectedSource.value?.id).toBe('source-b')
    expect(browser.sourceArticlesLoading.value).toBe(true)

    sourceBResponse.resolve()
    await secondOpen
    await flushPromises()

    expect(browser.selectedSource.value?.id).toBe('source-b')
    expect(browser.sourceArticles.value.map((item) => item.feed_item?.id)).toEqual(['item-b'])
    expect(browser.sourceArticlesLoading.value).toBe(false)

    sourceAResponse.resolve()
    await firstOpen
    await flushPromises()

    expect(browser.selectedSource.value?.id).toBe('source-b')
    expect(browser.sourceArticles.value.map((item) => item.feed_item?.id)).toEqual(['item-b'])

    wrapper.unmount()
  })
})
