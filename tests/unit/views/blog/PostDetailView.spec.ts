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
})
