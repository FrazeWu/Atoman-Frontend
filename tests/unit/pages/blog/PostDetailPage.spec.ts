import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VUE_QUERY_CLIENT } from '@tanstack/vue-query'
import { createTestQueryClient } from '../../helpers/queryClient'
import * as postApi from '@/entities/post/api/postApi'
import PostDetailPage from '@/pages/blog/PostDetailPage.vue'

describe('PostDetailPage', () => {
  let queryClient: ReturnType<typeof createTestQueryClient>

  beforeEach(() => {
    vi.restoreAllMocks()
    queryClient = createTestQueryClient()
  })

  const mountPage = async (routePath = '/posts/post/123') => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts/post/:id', component: PostDetailPage },
        { path: '/posts/:slugOrId', component: PostDetailPage },
      ],
    })
    await router.push(routePath)
    await router.isReady()

    return mount(PostDetailPage, {
      global: {
        plugins: [router],
        provide: {
          [VUE_QUERY_CLIENT]: queryClient,
        },
        stubs: {
          PSkeleton: { template: '<div class="p-skeleton-stub" />' },
          PEmpty: {
            props: ['title', 'description'],
            template: '<div class="p-empty-stub"><h3>{{ title }}</h3><p>{{ description }}</p><slot name="action" /></div>',
          },
          BlogPostReader: {
            props: ['post', 'postId'],
            template: '<div class="blog-post-reader-stub" :data-post-id="postId">{{ post?.title }}</div>',
          },
        },
      },
    })
  }

  it('renders loading skeleton while post is fetching', async () => {
    vi.spyOn(postApi, 'getPostById').mockImplementation(() => new Promise(() => {}))
    const wrapper = await mountPage()
    expect(wrapper.find('.post-detail-page__loading').exists()).toBe(true)
    expect(wrapper.findAll('.p-skeleton-stub').length).toBeGreaterThan(0)
  })

  it('renders error state and handles refetch on failure', async () => {
    const spy = vi.spyOn(postApi, 'getPostById').mockRejectedValueOnce(new Error('Network Error'))
    const wrapper = await mountPage()
    await flushPromises()

    expect(wrapper.find('.post-detail-page__error').exists()).toBe(true)
    expect(wrapper.text()).toContain('文章加载失败')
    expect(wrapper.text()).toContain('Network Error')

    spy.mockResolvedValueOnce({
      id: 123,
      slug: 'my-post',
      title: 'My Recovered Post',
      content: 'hello',
      visibility: 'public',
      createdAt: '2026-10-17T00:00:00Z',
    } as any)

    const retryBtn = wrapper.find('.post-detail-page__error button')
    expect(retryBtn.exists()).toBe(true)
    await retryBtn.trigger('click')
    await flushPromises()

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('My Recovered Post')
    })
  })

  it('renders BlogPostReader when post is successfully fetched', async () => {
    vi.spyOn(postApi, 'getPostById').mockResolvedValueOnce({
      id: 123,
      slug: 'vue-fsd',
      title: 'Vue FSD Architecture',
      content: 'Great architecture',
      visibility: 'public',
      createdAt: '2026-10-17T00:00:00Z',
    } as any)

    const wrapper = await mountPage('/posts/post/123')
    await flushPromises()

    await vi.waitFor(() => {
      expect(wrapper.find('.blog-post-reader-stub').exists()).toBe(true)
      expect(wrapper.text()).toContain('Vue FSD Architecture')
    })
  })
})
