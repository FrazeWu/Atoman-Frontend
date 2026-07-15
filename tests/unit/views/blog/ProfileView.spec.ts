import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ProfileView from '@/views/blog/ProfileView.vue'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { username: 'alice' } }),
  useRouter: () => ({ push }),
  RouterLink: { template: '<a><slot /></a>' },
}))

vi.mock('@/router/siteContext', () => ({
  resolveSiteContext: () => ({ type: 'module', module: 'blog' }),
}))

describe('ProfileView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockReset()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/by-username/alice')) {
        return new Response(JSON.stringify({ data: {
          uuid: 'user-1',
          username: 'alice',
          display_name: 'Alice',
          followers_count: 0,
          following_count: 0,
          posts_count: 1,
        } }), { status: 200 })
      }
      if (url.includes('/blog/channels?user_id=user-1')) {
        return new Response(JSON.stringify({ data: [
          { id: 'channel-blog', user_id: 'user-1', name: '文章频道', slug: 'articles', content_type: 'blog' },
          { id: 'channel-video', user_id: 'user-1', name: '视频频道', slug: 'videos', content_type: 'video' },
        ] }), { status: 200 })
      }
      if (url.includes('/blog/posts?user_id=user-1')) {
        return new Response(JSON.stringify({ data: [{
          id: 'post-1',
          user_id: 'user-1',
          title: '真实文章',
          content: '正文',
          status: 'published',
          visibility: 'public',
          allow_comments: true,
          pinned: false,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        }] }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))
  })

  it('点击真实文章进入已注册的文章详情路由', async () => {
    const wrapper = mount(ProfileView, {
      global: {
        stubs: {
          BookmarkFolderModal: true,
          ChannelView: true,
          PAvatar: true,
          PBadge: true,
          PButton: true,
          PClip: true,
          PEmpty: true,
          PToast: true,
          PEntry: { props: ['title'], template: '<article @click="$emit(\'click\')">{{ title }}</article>' },
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('文章频道')
    expect(wrapper.text()).not.toContain('视频频道')
    await wrapper.get('article').trigger('click')

    expect(push).toHaveBeenCalledWith('/posts/post/post-1')
  })
})
