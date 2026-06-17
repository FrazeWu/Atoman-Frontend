import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'

describe('FeedArticleSheet', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('sanitizes external feed HTML before rendering it', () => {
    const wrapper = mount(FeedArticleSheet, {
      props: {
        show: true,
        article: {
          type: 'feed_item',
          published_at: '2026-06-17T00:00:00Z',
          is_read: false,
          feed_item: {
            id: 'feed-item-1',
            feed_source_id: 'source-1',
            guid: 'guid-1',
            title: '外部文章',
            link: 'https://example.com/article',
            summary: '<p>正文</p><img src="x" onerror="alert(1)"><script>alert(1)</script>',
            published_at: '2026-06-17T00:00:00Z',
            fetched_at: '2026-06-17T00:00:00Z',
          },
        },
      },
      global: {
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
          PBadge: true,
        },
      },
    })

    const html = wrapper.html()
    expect(html).toContain('正文')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
  })
})
