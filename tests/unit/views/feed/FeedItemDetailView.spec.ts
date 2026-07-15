import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import CommentSection from '@/components/comment/CommentSection.vue'
import FeedItemDetailView from '@/views/feed/FeedItemDetailView.vue'

vi.mock('@/components/comment/CommentSection.vue', () => ({
  default: { name: 'CommentSection', props: ['target'], template: '<section />' },
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

const feedResponse = (id: string, title: string) => new Response(JSON.stringify({ data: {
  id, feed_source_id: 'source-1', guid: id, title,
  link: `https://example.com/${id}`, summary: '摘要', author: '作者',
  published_at: '2026-07-01T00:00:00Z', fetched_at: '2026-07-01T00:00:00Z',
} }), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('FeedItemDetailView comments', () => {
  it('uses the existing feed item id as the comment resource', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {
      id: 'feed-item-1', feed_source_id: 'source-1', guid: 'guid-1', title: '文章',
      link: 'https://example.com/article', summary: '摘要', author: '作者',
      published_at: '2026-07-01T00:00:00Z', fetched_at: '2026-07-01T00:00:00Z',
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/feed/items/:id', component: FeedItemDetailView }] })
    await router.push('/feed/items/feed-item-1')
    const wrapper = mount(FeedItemDetailView, {
      global: {
        plugins: [createPinia(), router],
        stubs: { CommentSection: { name: 'CommentSection', props: ['target'], template: '<section />' } },
      },
    })
    await flushPromises()

    expect(wrapper.findComponent(CommentSection).props('target')).toEqual({ kind: 'feed_article', resourceId: 'feed-item-1' })
  })

  it('keeps the latest route item when responses complete out of order', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') return Promise.resolve(new Response('{}', { status: 200 }))
      return String(input).endsWith('/feed-a') ? first.promise : second.promise
    }))
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/feed/items/:id', component: FeedItemDetailView }] })
    await router.push('/feed/items/feed-a')
    const wrapper = mount(FeedItemDetailView, {
      global: {
        plugins: [createPinia(), router],
        stubs: { CommentSection: { name: 'CommentSection', props: ['target'], template: '<section />' } },
      },
    })

    await router.push('/feed/items/feed-b')
    second.resolve(feedResponse('feed-b', '当前文章'))
    await flushPromises()
    expect(wrapper.findComponent(CommentSection).props('target')).toEqual({ kind: 'feed_article', resourceId: 'feed-b' })

    first.resolve(feedResponse('feed-a', '过期文章'))
    await flushPromises()
    expect(wrapper.text()).toContain('当前文章')
    expect(wrapper.text()).not.toContain('过期文章')
  })
})
