import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PostDetailView from '@/views/blog/PostDetailView.vue'

vi.mock('vue-router', () => ({
  RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  useRoute: () => ({ params: { id: 'post-1' } }),
}))

describe('PostDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    document.title = 'Atoman'
    document.head.querySelectorAll('[data-page-meta]').forEach(element => element.remove())
    window.history.replaceState({}, '', '/posts/post/post-1')
  })

  it('renders collection navigation, table of contents, timestamps and public stats', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/blog/posts/post-1')) {
        return new Response(JSON.stringify({
          data: {
            id: 'post-1',
            user_id: 'author-1',
            user: { username: 'alice', display_name: 'Alice' },
            channel_id: 'channel-1',
            channel: { id: 'channel-1', name: '随笔' },
            collection_id: 'collection-1',
            collection: { id: 'collection-1', channel_id: 'channel-1', name: '旅行合集' },
            title: '柏林散步',
            content: '## 出发\n正文\n## 街区\n正文\n## 夜晚\n正文',
            summary: '摘要',
            status: 'published',
            visibility: 'public',
            allow_comments: true,
            pinned: false,
            published_at: '2026-07-10T08:00:00Z',
            created_at: '2026-07-10T08:00:00Z',
            updated_at: '2026-07-14T09:30:00Z',
            view_count: 120,
            likes_count: 8,
            comments_count: 3,
            bookmarks_count: 5,
            channel_followers_count: 21,
          },
        }), { status: 200 })
      }
      if (url.includes('/blog/posts?collection_id=collection-1')) {
        return new Response(JSON.stringify({
          data: [
            { id: 'post-0', title: '上一站', collection_position: 0 },
            { id: 'post-1', title: '柏林散步', collection_position: 1 },
            { id: 'post-2', title: '下一站', collection_position: 2 },
          ],
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: {} }), { status: 200 })
    })

    const wrapper = mount(PostDetailView, {
      global: {
        stubs: {
          CommentSection: true,
          PToast: true,
          PSheet: true,
          PModal: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.get('[data-test="collection-rail"]').text()).toContain('旅行合集')
    expect(wrapper.get('[data-test="collection-rail"]').text()).toContain('上一站')
    expect(wrapper.get('[data-test="toc-rail"]').text()).toContain('夜晚')
    expect(wrapper.find('[data-test="mobile-collection"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="mobile-toc"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('发布于 2026年7月10日')
    expect(wrapper.text()).toContain('更新于 2026年7月14日')
    expect(wrapper.text()).toContain('120 阅读')
    expect(wrapper.text()).toContain('8 点赞')
    expect(wrapper.text()).toContain('3 评论')
    expect(wrapper.text()).toContain('5 收藏')
    expect(wrapper.text()).toContain('21 订阅')
  })

  it('updates article metadata after loading and restores defaults after unmount', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).includes('/blog/posts/post-1')) {
        return new Response(JSON.stringify({ data: {
          id: 'post-1', user_id: 'author-1', user: { username: 'alice', display_name: 'Alice' },
          title: '柏林散步', content: '正文', summary: '文章摘要', cover_url: 'https://assets.example/cover.jpg',
          status: 'published', visibility: 'public', allow_comments: true, pinned: false,
          published_at: '2026-07-10T08:00:00Z', created_at: '2026-07-10T08:00:00Z', updated_at: '2026-07-14T09:30:00Z',
        } }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: {} }), { status: 200 })
    })

    const wrapper = mount(PostDetailView, { global: { stubs: { CommentSection: true, PToast: true, PSheet: true } } })
    await flushPromises()

    expect(document.title).toBe('柏林散步 | Atoman')
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('文章摘要')
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${window.location.origin}/posts/post/post-1`)
    expect(document.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('article')
    expect(document.querySelector('script[type="application/ld+json"]')?.textContent).toContain('BlogPosting')

    wrapper.unmount()
    expect(document.title).toBe('Atoman')
    expect(document.head.querySelector('[data-page-meta]')).toBeNull()
  })

  it('uses native sharing and falls back to copying when sharing fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => String(input).includes('/blog/posts/post-1')
      ? new Response(JSON.stringify({ data: {
          id: 'post-1', user_id: 'author-1', title: '柏林散步', content: '正文', summary: '文章摘要',
          status: 'published', visibility: 'public', allow_comments: true, pinned: false,
          created_at: '2026-07-10T08:00:00Z', updated_at: '2026-07-14T09:30:00Z',
        } }))
      : new Response(JSON.stringify({ data: {} })))
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, clipboard: { writeText } })

    const wrapper = mount(PostDetailView, { global: { stubs: { CommentSection: true, PToast: true, PSheet: true } } })
    await flushPromises()
    await wrapper.get('button[title="分享"]').trigger('click')

    expect(share).toHaveBeenCalledWith({ title: '柏林散步', text: '文章摘要', url: `${window.location.origin}/posts/post/post-1` })
    expect(writeText).not.toHaveBeenCalled()

    share.mockRejectedValueOnce(new Error('share unavailable'))
    await wrapper.get('button[title="分享"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/posts/post/post-1`)

    share.mockRejectedValueOnce(new DOMException('cancelled', 'AbortError'))
    await wrapper.get('button[title="分享"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledTimes(1)
  })
})
