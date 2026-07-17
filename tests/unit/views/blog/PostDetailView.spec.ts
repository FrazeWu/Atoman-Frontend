import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PostDetailView from '@/views/blog/PostDetailView.vue'
import { useAuthStore } from '@/stores/auth'

vi.mock('vue-router', () => ({
  RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  useRoute: () => ({ params: { id: 'post-1' } }),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

const detailStubs = {
  CommentSection: true,
  PToast: true,
  PSheet: true,
  PModal: true,
}

const makePostResponse = (id: string, likesCount: number, liked = false) =>
  new Response(JSON.stringify({ data: {
    id,
    user_id: 'author-1',
    title: `文章 ${id}`,
    content: '正文',
    status: 'published',
    visibility: 'public',
    allow_comments: true,
    liked,
    likes_count: likesCount,
    created_at: '2026-07-10T08:00:00Z',
    updated_at: '2026-07-10T08:00:00Z',
  } }), { status: 200 })

describe('PostDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    document.title = 'Atoman'
    document.head.querySelectorAll('[data-page-meta]').forEach(element => element.remove())
    window.history.replaceState({}, '', '/posts/post/post-1')
  })

  it('renders collection navigation, table of contents, timestamps and public stats', async () => {
    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'author-1', username: 'alice', email: 'alice@example.com' }
    auth.isAuthenticated = true

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
      if (url.includes('/blog/bookmarks')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/feed/reading-list')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 })
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
    expect(wrapper.find('a[href="/posts/post/post-0"]').exists()).toBe(true)
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
    expect(wrapper.find('a[href="/posts"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/posts/post/post-1/edit"]').exists()).toBe(true)
  })

  it('loads real video data for video embeds', async () => {
    const videoID = '33333333-3333-3333-3333-333333333333'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/blog/posts/post-1')) {
        return new Response(JSON.stringify({ data: {
          id: 'post-1',
          user_id: 'author-1',
          title: '含视频的文章',
          content: `:::video{id="${videoID}"}\n:::`,
          status: 'published',
          visibility: 'public',
          allow_comments: true,
          pinned: false,
          created_at: '2026-07-10T08:00:00Z',
          updated_at: '2026-07-10T08:00:00Z',
        } }), { status: 200 })
      }
      if (url.endsWith(`/videos/${videoID}`)) {
        return new Response(JSON.stringify({
          id: videoID,
          title: '真实视频标题',
          description: '真实视频简介',
          thumbnail_url: 'https://cdn.example.com/video.jpg',
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
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

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`/videos/${videoID}$`)),
      expect.any(Object),
    )
    expect(wrapper.html()).toContain('真实视频标题')
    expect(wrapper.html()).toContain(`/videos/watch/${videoID}`)
  })

  it('点赞成功后使用真实计数接口返回的权威数量', async () => {
    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'reader-1', username: 'reader', email: 'reader@example.com' }
    auth.isAuthenticated = true

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.endsWith('/blog/posts/post-1/likes/count')) {
        return new Response(JSON.stringify({ data: { count: 12 } }), { status: 200 })
      }
      if (url.endsWith('/blog/posts/post-1')) {
        return new Response(JSON.stringify({ data: {
          id: 'post-1',
          user_id: 'author-1',
          title: '真实计数文章',
          content: '正文',
          status: 'published',
          visibility: 'public',
          allow_comments: true,
          liked: false,
          likes_count: 8,
          created_at: '2026-07-10T08:00:00Z',
          updated_at: '2026-07-10T08:00:00Z',
        } }), { status: 200 })
      }
      if (url.endsWith('/blog/likes') && init?.method === 'POST') {
        return new Response(JSON.stringify({ data: { message: 'ok' } }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
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

    await wrapper.get('button[title="点赞"]').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/blog/posts/post-1/likes/count')
    expect(wrapper.get('button[title="点赞"]').text()).toContain('12')
  })

  it('点赞请求未完成时重复点击只发送一个 mutation', async () => {
    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'reader-1', username: 'reader', email: 'reader@example.com' }
    auth.isAuthenticated = true
    const mutation = deferred<Response>()

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url.endsWith('/blog/posts/post-1')) return Promise.resolve(makePostResponse('post-1', 8))
      if (url.endsWith('/blog/likes') && init?.method === 'POST') return mutation.promise
      if (url.endsWith('/blog/posts/post-1/likes/count')) {
        return Promise.resolve(new Response(JSON.stringify({ data: { count: 9 } }), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    })

    const wrapper = mount(PostDetailView, { global: { stubs: detailStubs } })
    await flushPromises()

    const likeButton = wrapper.get('button[title="点赞"]')
    await likeButton.trigger('click')
    await likeButton.trigger('click')

    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/blog/likes'))).toHaveLength(1)
    expect(likeButton.attributes('disabled')).toBeDefined()

    mutation.resolve(new Response(JSON.stringify({ data: { message: 'ok' } }), { status: 200 }))
    await flushPromises()
  })

  it('文章 A 的迟到点赞响应不能请求 B 的计数或改写 B 状态', async () => {
    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'reader-1', username: 'reader', email: 'reader@example.com' }
    auth.isAuthenticated = true
    const mutationA = deferred<Response>()

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url.endsWith('/blog/posts/post-a')) return Promise.resolve(makePostResponse('post-a', 8))
      if (url.endsWith('/blog/posts/post-b')) return Promise.resolve(makePostResponse('post-b', 20))
      if (url.endsWith('/blog/likes') && init?.method === 'POST') return mutationA.promise
      if (url.includes('/likes/count')) {
        return Promise.resolve(new Response(JSON.stringify({ data: { count: 99 } }), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    })

    const wrapper = mount(PostDetailView, {
      props: { id: 'post-a' },
      global: { stubs: detailStubs },
    })
    await flushPromises()

    await wrapper.get('button[title="点赞"]').trigger('click')
    await wrapper.setProps({ id: 'post-b' })
    await flushPromises()
    expect(wrapper.text()).toContain('文章 post-b')

    mutationA.resolve(new Response(JSON.stringify({ data: { message: 'ok' } }), { status: 200 }))
    await flushPromises()

    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/likes/count'))).toBe(false)
    expect(wrapper.get('button[title="点赞"]').text()).toContain('20')
    expect(wrapper.get('button[title="点赞"]').classes()).not.toContain('active')
  })

  it('文章 A 的迟到计数响应不能改写文章 B', async () => {
    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'reader-1', username: 'reader', email: 'reader@example.com' }
    auth.isAuthenticated = true
    const countA = deferred<Response>()

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url.endsWith('/blog/posts/post-a/likes/count')) return countA.promise
      if (url.endsWith('/blog/posts/post-a')) return Promise.resolve(makePostResponse('post-a', 8))
      if (url.endsWith('/blog/posts/post-b')) return Promise.resolve(makePostResponse('post-b', 20))
      if (url.endsWith('/blog/likes') && init?.method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify({ data: { message: 'ok' } }), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    })

    const wrapper = mount(PostDetailView, {
      props: { id: 'post-a' },
      global: { stubs: detailStubs },
    })
    await flushPromises()

    await wrapper.get('button[title="点赞"]').trigger('click')
    await flushPromises()
    await wrapper.setProps({ id: 'post-b' })
    await flushPromises()

    countA.resolve(new Response(JSON.stringify({ data: { count: 99 } }), { status: 200 }))
    await flushPromises()

    expect(wrapper.get('button[title="点赞"]').text()).toContain('20')
    expect(wrapper.get('button[title="点赞"]').classes()).not.toContain('active')
  })

  it.each([
    { name: 'mutation 失败', mutationStatus: 500, countStatus: 200, countCalls: 0, active: false },
    { name: 'count 失败', mutationStatus: 200, countStatus: 500, countCalls: 1, active: true },
  ])('$name 时不改写旧计数', async ({ mutationStatus, countStatus, countCalls, active }) => {
    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'reader-1', username: 'reader', email: 'reader@example.com' }
    auth.isAuthenticated = true

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.endsWith('/blog/posts/post-1/likes/count')) {
        return new Response(JSON.stringify({ data: { count: 99 } }), { status: countStatus })
      }
      if (url.endsWith('/blog/posts/post-1')) return makePostResponse('post-1', 8)
      if (url.endsWith('/blog/likes') && init?.method === 'POST') {
        return new Response(JSON.stringify({ data: { message: 'ok' } }), { status: mutationStatus })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })

    const wrapper = mount(PostDetailView, { global: { stubs: detailStubs } })
    await flushPromises()
    await wrapper.get('button[title="点赞"]').trigger('click')
    await flushPromises()

    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('/likes/count'))).toHaveLength(countCalls)
    expect(wrapper.get('button[title="点赞"]').text()).toContain('8')
    expect(wrapper.get('button[title="点赞"]').classes().includes('active')).toBe(active)
  })

  it('renders article content without mutating global page metadata', async () => {
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

    expect(wrapper.get('h1').text()).toBe('柏林散步')
    expect(document.title).toBe('Atoman')
    expect(document.head.querySelector('[data-page-meta]')).toBeNull()

    wrapper.unmount()
    expect(document.title).toBe('Atoman')
    expect(document.head.querySelector('[data-page-meta]')).toBeNull()
  })

  it('copies the article link', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => String(input).includes('/blog/posts/post-1')
      ? new Response(JSON.stringify({ data: {
          id: 'post-1', user_id: 'author-1', title: '柏林散步', content: '正文', summary: '文章摘要',
          status: 'published', visibility: 'public', allow_comments: true, pinned: false,
          created_at: '2026-07-10T08:00:00Z', updated_at: '2026-07-14T09:30:00Z',
        } }))
      : new Response(JSON.stringify({ data: {} })))
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const wrapper = mount(PostDetailView, { global: { stubs: { CommentSection: true, PToast: true, PSheet: true } } })
    await flushPromises()
    await wrapper.get('button[title="复制链接"]').trigger('click')

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/posts/post/post-1`)

    writeText.mockRejectedValueOnce(new Error('clipboard unavailable'))
    await wrapper.get('button[title="复制链接"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledTimes(2)
  })
})
