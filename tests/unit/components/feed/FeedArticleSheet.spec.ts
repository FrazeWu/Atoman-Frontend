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
})
