import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BlogPostReader from '@/components/blog/BlogPostReader.vue'
import { useAuthStore } from '@/stores/auth'

const post = {
  id: 'post-1',
  user_id: 'user-1',
  user: { uuid: 'user-1', username: 'author' },
  title: '文章一',
  content: '正文',
  status: 'published',
  visibility: 'public',
  created_at: '2026-07-12T00:00:00Z',
  updated_at: '2026-07-13T00:00:00Z',
}

const jsonResponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

const stubs = {
  BlogMediaContent: { template: '<div />' },
  BlogPostUpdateNotice: { template: '<div />' },
  BlogRelatedPosts: { template: '<div />' },
  CommentSideSheet: { template: '<div />' },
  PAvatar: { template: '<div />' },
  PDiscussionFAB: { template: '<div />' },
  PostRatingControl: { template: '<div />' },
  PSegmentedControl: { template: '<div />' },
  PToast: { template: '<div />' },
}

function mountReader() {
  return mount(BlogPostReader, {
    props: { postId: 'post-1', presentation: 'sheet' },
    global: { stubs },
  })
}

async function openBookmarkMenu(wrapper: ReturnType<typeof mountReader>) {
  await flushPromises()
  await wrapper.get('.post-sheet-actions-row .p-button').trigger('click')
  await flushPromises()
}

describe('BlogPostReader 收藏夹', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.token = 'token'
    auth.isAuthenticated = true
    auth.user = { uuid: 'user-1', username: 'author' } as never
  })

  it('创建收藏夹失败时显示错误，并保留可重试表单', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/posts/post-1')) return jsonResponse({ data: post })
      if (url.includes('/blog/bookmark-folders') && init?.method === 'POST') {
        return jsonResponse({ error: { message: '收藏夹名称已存在' } }, 409)
      }
      if (url.includes('/blog/bookmark-folders')) return jsonResponse({ data: [{ id: 'default', name: '默认收藏夹' }] })
      if (url.includes('/blog/bookmarks')) return jsonResponse({ data: [] })
      if (url.includes('/related')) return jsonResponse({ data: [] })
      return jsonResponse({ data: {} })
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mountReader()
    await openBookmarkMenu(wrapper)
    await wrapper.get('input[aria-label="新收藏夹名称"]').setValue('华为')
    await wrapper.get('.post-bookmark-menu__create-form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('收藏夹名称已存在')
    expect(wrapper.get('input[aria-label="新收藏夹名称"]').exists()).toBe(true)
  })

  it('使用独立的创建行避免收藏夹列表与输入框重叠', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/blog/posts/post-1')) return jsonResponse({ data: post })
      if (url.includes('/blog/bookmark-folders')) return jsonResponse({ data: [{ id: 'default', name: '默认收藏夹' }] })
      if (url.includes('/blog/bookmarks')) return jsonResponse({ data: [] })
      if (url.includes('/related')) return jsonResponse({ data: [] })
      return jsonResponse({ data: {} })
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mountReader()
    await openBookmarkMenu(wrapper)

    expect(wrapper.get('.post-bookmark-menu__folders').text()).toContain('默认收藏夹')
    expect(wrapper.get('.post-bookmark-menu__create-form').exists()).toBe(true)
    expect(wrapper.get('.post-bookmark-menu__create-row').find('input').exists()).toBe(true)
    expect(wrapper.get('.post-bookmark-menu__create-row').find('.p-button').text()).toBe('新建')
  })

  it('创建成功后将文章加入新收藏夹并关闭菜单', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/posts/post-1')) return jsonResponse({ data: post })
      if (url.includes('/blog/bookmark-folders') && init?.method === 'POST') {
        return jsonResponse({ data: { id: 'folder-new', name: '华为' } }, 201)
      }
      if (url.includes('/blog/bookmark-folders')) return jsonResponse({ data: [{ id: 'default', name: '默认收藏夹' }] })
      if (url.includes('/blog/bookmarks') && init?.method === 'POST') return jsonResponse({ data: { id: 'bookmark-1' } }, 201)
      if (url.includes('/blog/bookmarks')) return jsonResponse({ data: [] })
      if (url.includes('/related')) return jsonResponse({ data: [] })
      return jsonResponse({ data: {} })
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mountReader()
    await openBookmarkMenu(wrapper)
    await wrapper.get('input[aria-label="新收藏夹名称"]').setValue('华为')
    await wrapper.get('.post-bookmark-menu__create-form').trigger('submit')
    await flushPromises()

    const createRequest = fetchMock.mock.calls.find(([input, init]) => (
      String(input).includes('/blog/bookmark-folders') && init?.method === 'POST'
    ))
    const bookmarkRequest = fetchMock.mock.calls.find(([input, init]) => (
      String(input).endsWith('/blog/bookmarks') && init?.method === 'POST'
    ))
    expect(JSON.parse(String(createRequest?.[1]?.body))).toEqual({ name: '华为' })
    expect(JSON.parse(String(bookmarkRequest?.[1]?.body))).toEqual({
      content_id: 'post-1',
      bookmark_folder_id: 'folder-new',
    })
    expect(wrapper.find('.post-bookmark-menu').exists()).toBe(false)
  })
})
