import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'
import CommentSection from '@/components/comment/CommentSection.vue'

vi.mock('@/components/comment/CommentSection.vue', () => ({
  default: { name: 'CommentSection', props: ['target'], template: '<section />' },
}))

describe('FeedArticleSheet', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('uses the same existing feed item id as the detail page', () => {
    const wrapper = mount(FeedArticleSheet, {
      props: {
        show: true,
        article: {
          type: 'feed_item', published_at: '2026-07-01T00:00:00Z', is_read: false,
          feed_item: {
            id: 'feed-item-1', feed_source_id: 'source-1', guid: 'guid-1', title: '文章',
            link: 'https://example.com/article', summary: '摘要', author: '作者',
            published_at: '2026-07-01T00:00:00Z', fetched_at: '2026-07-01T00:00:00Z',
          },
        },
      },
      global: {
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
          PBadge: true,
          CommentSection: { name: 'CommentSection', props: ['target'], template: '<section />' },
        },
      },
    })

    expect(wrapper.findComponent(CommentSection).props('target')).toEqual({ kind: 'feed_article', resourceId: 'feed-item-1' })
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

  it('marks external feed content as width constrained prose', () => {
    const wrapper = mount(FeedArticleSheet, {
      props: {
        show: true,
        article: {
          type: 'feed_item',
          published_at: '2026-06-29T00:00:00Z',
          is_read: false,
          feed_item: {
            id: 'feed-item-wide-content-1',
            feed_source_id: 'source-wide-content-1',
            guid: 'guid-wide-content-1',
            title: '包含超长内容的外部文章',
            link: 'https://example.com/article',
            summary: '<p>https://example.com/very-long-unbroken-url-that-should-not-expand-the-page-width</p>',
            published_at: '2026-06-29T00:00:00Z',
            fetched_at: '2026-06-29T00:00:00Z',
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

    expect(wrapper.get('.article-body').classes()).toContain('article-body--external-feed')
  })

  it('renders a play button for podcast feed items and emits play-podcast when clicked', async () => {
    const wrapper = mount(FeedArticleSheet, {
      props: {
        show: true,
        article: {
          type: 'feed_item',
          published_at: '2026-06-20T00:00:00Z',
          is_read: false,
          feed_item: {
            id: 'feed-item-podcast-1',
            feed_source_id: 'source-1',
            guid: 'guid-podcast-1',
            title: '播客节目',
            link: 'https://example.com/episode',
            enclosure_url: 'https://cdn.example.com/audio.mp3',
            enclosure_type: 'audio/mpeg',
            summary: '<p>节目摘要</p>',
            published_at: '2026-06-20T00:00:00Z',
            fetched_at: '2026-06-20T00:00:00Z',
          },
        },
        isPodcastPlaying: false,
      },
      global: {
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
          PBadge: true,
        },
      },
    })

    const playButton = wrapper.get('[data-test="feed-article-play"]')
    expect(playButton.text()).toContain('播放播客')

    await playButton.trigger('click')

    expect(wrapper.emitted('play-podcast')?.[0]?.[0]).toMatchObject({
      id: 'feed-item-podcast-1',
    })
  })

  it('does not render a play button for non-audio feed items', () => {
    const wrapper = mount(FeedArticleSheet, {
      props: {
        show: true,
        article: {
          type: 'feed_item',
          published_at: '2026-06-20T00:00:00Z',
          is_read: false,
          feed_item: {
            id: 'feed-item-2',
            feed_source_id: 'source-2',
            guid: 'guid-2',
            title: '普通文章',
            link: 'https://example.com/article',
            summary: '<p>摘要</p>',
            published_at: '2026-06-20T00:00:00Z',
            fetched_at: '2026-06-20T00:00:00Z',
          },
        },
        isPodcastPlaying: false,
      },
      global: {
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
          PBadge: true,
        },
      },
    })

    expect(wrapper.find('[data-test="feed-article-play"]').exists()).toBe(false)
  })

  it('shows the playing label when the current podcast is already playing', () => {
    const wrapper = mount(FeedArticleSheet, {
      props: {
        show: true,
        article: {
          type: 'feed_item',
          published_at: '2026-06-20T00:00:00Z',
          is_read: false,
          feed_item: {
            id: 'feed-item-playing-1',
            feed_source_id: 'source-3',
            guid: 'guid-3',
            title: '正在播放的播客',
            link: 'https://example.com/playing',
            enclosure_url: 'https://cdn.example.com/playing.mp3',
            enclosure_type: 'audio/mpeg',
            summary: '<p>摘要</p>',
            published_at: '2026-06-20T00:00:00Z',
            fetched_at: '2026-06-20T00:00:00Z',
          },
        },
        isPodcastPlaying: true,
      },
      global: {
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
          PBadge: true,
        },
      },
    })

    expect(wrapper.get('[data-test="feed-article-play"]').text()).toContain('播放中')
  })

  it('shows richer external article reading metadata for readability', () => {
    const wrapper = mount(FeedArticleSheet, {
      props: {
        show: true,
        article: {
          type: 'feed_item',
          published_at: '2026-06-20T00:00:00Z',
          is_read: false,
          feed_item: {
            id: 'feed-item-meta-1',
            feed_source_id: 'source-meta-1',
            guid: 'guid-meta-1',
            title: '带有完整状态信息的外部文章',
            link: 'https://example.com/meta',
            summary: '<p>这是一段摘要内容。</p>',
            author: '外部作者',
            published_at: '2026-06-20T00:00:00Z',
            fetched_at: '2026-06-20T08:30:00Z',
            full_text_status: 'success',
            content_source: 'full_text',
            full_text_word_count: 1280,
            feed_source: {
              id: 'source-meta-1',
              source_type: 'external_rss',
              title: 'Longform Weekly',
              created_at: '2026-06-01T00:00:00Z',
            },
          },
        } as any,
      },
      global: {
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
          PBadge: true,
        },
      },
    })

    expect(wrapper.text()).toContain('Longform Weekly')
    expect(wrapper.text()).toContain('FULL TEXT')
    expect(wrapper.text()).toContain('约 1280 字')
    expect(wrapper.text()).toContain('抓取于 2026年6月20日')
  })

  it('renders previous and next navigation controls when neighboring items exist', async () => {
    const wrapper = mount(FeedArticleSheet, {
      props: {
        show: true,
        article: {
          type: 'feed_item',
          published_at: '2026-06-20T00:00:00Z',
          is_read: false,
          feed_item: {
            id: 'feed-item-nav-2',
            feed_source_id: 'source-nav',
            guid: 'guid-nav-2',
            title: '第二篇文章',
            link: 'https://example.com/nav-2',
            summary: '<p>摘要</p>',
            published_at: '2026-06-20T00:00:00Z',
            fetched_at: '2026-06-20T00:00:00Z',
          },
        } as any,
        hasPrevious: true,
        hasNext: true,
      },
      global: {
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
          PBadge: true,
        },
      },
    })

    await wrapper.get('[data-test="feed-article-prev"]').trigger('click')
    await wrapper.get('[data-test="feed-article-next"]').trigger('click')

    expect(wrapper.emitted('previous')).toEqual([[]])
    expect(wrapper.emitted('next')).toEqual([[]])
  })

  it('explains whether the reader is showing full text or only a summary', () => {
    const fullTextWrapper = mount(FeedArticleSheet, {
      props: {
        show: true,
        article: {
          type: 'feed_item',
          published_at: '2026-06-20T00:00:00Z',
          is_read: false,
          feed_item: {
            id: 'feed-item-status-1',
            feed_source_id: 'source-status-1',
            guid: 'guid-status-1',
            title: '全文文章',
            link: 'https://example.com/full',
            summary: '<p>摘要</p>',
            full_text_html: '<p>全文</p>',
            full_text_status: 'success',
            content_source: 'full_text',
            published_at: '2026-06-20T00:00:00Z',
            fetched_at: '2026-06-20T00:00:00Z',
          },
        } as any,
      },
      global: {
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
          PBadge: true,
        },
      },
    })

    const summaryWrapper = mount(FeedArticleSheet, {
      props: {
        show: true,
        article: {
          type: 'feed_item',
          published_at: '2026-06-20T00:00:00Z',
          is_read: false,
          feed_item: {
            id: 'feed-item-status-2',
            feed_source_id: 'source-status-2',
            guid: 'guid-status-2',
            title: '摘要文章',
            link: 'https://example.com/summary',
            summary: '<p>仅摘要</p>',
            full_text_status: 'failed',
            full_text_error: 'fetch timeout',
            published_at: '2026-06-20T00:00:00Z',
            fetched_at: '2026-06-20T00:00:00Z',
          },
        } as any,
      },
      global: {
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
          PBadge: true,
        },
      },
    })

    expect(fullTextWrapper.text()).toContain('已展示抓取到的全文内容')
    expect(summaryWrapper.text()).toContain('当前仅展示摘要')
    expect(summaryWrapper.text()).toContain('fetch timeout')
  })

  it('falls back to content_html before summary when full-text status is available but html is missing', () => {
    const wrapper = mount(FeedArticleSheet, {
      props: {
        show: true,
        article: {
          type: 'feed_item',
          published_at: '2026-06-20T00:00:00Z',
          is_read: false,
          feed_item: {
            id: 'feed-item-fallback-1',
            feed_source_id: 'source-fallback-1',
            guid: 'guid-fallback-1',
            title: '正文回退文章',
            link: 'https://example.com/fallback',
            summary: '<p>只应作为最后回退的摘要</p>',
            content_html: '<p>这是清洗后的正文 HTML</p>',
            full_text_status: 'success',
            content_source: 'full_text',
            published_at: '2026-06-20T00:00:00Z',
            fetched_at: '2026-06-20T00:00:00Z',
          },
        } as any,
      },
      global: {
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
          PBadge: true,
        },
      },
    })

    expect(wrapper.html()).toContain('这是清洗后的正文 HTML')
    expect(wrapper.html()).not.toContain('只应作为最后回退的摘要')
  })
})
