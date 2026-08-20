import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// @ts-expect-error Vitest resolves Vue SFC imports through Vite, outside tsconfig's src-only include.
import BlogPostSheet from '../../../../src/components/blog/BlogPostSheet.vue'
import type { BlogPostLayer } from '../../../../src/components/blog/blogSheetTypes'
import { useAuthStore } from '../../../../src/stores/auth'

const layer: BlogPostLayer = {
  key: 'post:post-1',
  kind: 'post',
  title: '文章一',
  route: '/posts/post/post-1',
  payload: { postId: 'post-1', collectionId: 'collection-1' },
}

const response = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 })

describe('BlogPostSheet', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => response({
      id: 'post-1',
      user_id: 'user-1',
      user: { uuid: 'user-1', username: 'author' },
      channel_id: 'channel-1',
      title: '文章一',
      content: '正文',
      created_at: '2026-07-12T00:00:00Z',
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens the Studio editor and preserves collection context', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.token = 'token'
    auth.isAuthenticated = true
    auth.user = { uuid: 'user-1', username: 'author', email: 'author@example.com' }

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts', component: { template: '<div />' } },
        { path: '/studio/blog/:id/edit', component: { template: '<div />' } },
      ],
    })
    await router.push('/posts')
    await router.isReady()

    const wrapper = mount(BlogPostSheet, {
      props: { layer },
      global: {
        plugins: [pinia, router],
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
          PButton: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
        },
      },
    })
    await flushPromises()

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe(
      '/studio/blog/post-1/edit?channel=channel-1&collection=collection-1',
    )
  })
})
