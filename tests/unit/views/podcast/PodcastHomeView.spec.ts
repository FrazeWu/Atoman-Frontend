import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PodcastHomeView from '@/views/podcast/PodcastHomeView.vue'

const makeJsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('PodcastHomeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('loads recommended episodes and requests the featured endpoint after mode switch', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/podcast/recommend/episodes?mode=hot&page=1&page_size=8')) {
        return makeJsonResponse({ data: [{ id: 'episode-1', title: '推荐播客', summary: '推荐摘要', target_path: '/podcasts/episode/episode-1', content_type: 'podcast', score_label: '热度 90' }] })
      }
      if (url.includes('/podcast/recommend/episodes?mode=featured&page=1&page_size=8')) {
        return makeJsonResponse({ data: [{ id: 'episode-2', title: '精选播客', summary: '精选摘要', target_path: '/podcasts/episode/episode-2', content_type: 'podcast', score_label: '精选 86' }] })
      }
      if (url.endsWith('/podcast/episodes')) {
        return makeJsonResponse([])
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(PodcastHomeView, {
      global: {
        stubs: {
          PBadge: true,
          PEntry: {
            props: ['title', 'summary'],
            template: '<article class="podcast-entry">{{ title }}</article>',
          },
          PPageHeader: { template: '<header />' },
          PPress: { template: '<button><slot /></button>' },
          PSegmentedControl: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue', 'change'],
            template: `
              <div>
                <button
                  v-for="option in options"
                  :key="option.value"
                  type="button"
                  @click="$emit('update:modelValue', option.value); $emit('change', option.value)"
                >
                  {{ option.label }}
                </button>
              </div>
            `,
          },
        },
      },
    })

    await flushPromises()

    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input))
    expect(requestedUrls).toContain('/api/v1/podcast/recommend/episodes?mode=hot&page=1&page_size=8')

    await wrapper.findAll('button').find((button) => button.text() === '精选')!.trigger('click')
    await flushPromises()

    const requestedAfterSwitch = fetchMock.mock.calls.map(([input]) => String(input))
    expect(requestedAfterSwitch).toContain('/api/v1/podcast/recommend/episodes?mode=featured&page=1&page_size=8')
  })
})
