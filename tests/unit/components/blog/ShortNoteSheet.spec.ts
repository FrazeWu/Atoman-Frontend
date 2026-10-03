import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

// @ts-expect-error Vitest resolves Vue SFC imports through Vite.
import ShortNoteSheet from '../../../../src/components/blog/ShortNoteSheet.vue'
import type { ShortNoteLayer } from '../../../../src/components/blog/blogSheetTypes'
import { useAuthStore } from '../../../../src/stores/auth'

const layer: ShortNoteLayer = {
  key: 'short_note:note-1',
  kind: 'short_note',
  title: '短笺',
  payload: { noteId: 'note-1' },
}

const response = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 })

describe('ShortNoteSheet', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('弹层使用统一的点赞点踩组件', async () => {
    setActivePinia(createPinia())
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/posts', component: { template: '<div />' } }],
    })
    await router.push('/posts')
    await router.isReady()
    vi.stubGlobal('fetch', vi.fn(async () => response({
      id: 'note-1',
      user_id: 'user-1',
      content: '内容',
      created_at: '2026-07-01T00:00:00Z',
      media: [],
      likes_count: 3,
      dislikes_count: 1,
      viewer_vote: 'down',
      comments_count: 2,
    })))

    const wrapper = mount(ShortNoteSheet, {
      props: { layer },
      global: {
        plugins: [router],
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
          PInteractionActions: {
            props: ['liked', 'likeCount', 'disliked', 'dislikeCount'],
            template: '<div data-test="note-votes" :data-disliked="disliked" />',
          },
          PImageLightbox: true,
          CommentSideSheet: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.find('[data-test="note-votes"]').attributes('data-disliked')).toBe('true')
    expect(wrapper.findComponent({ name: 'InteractionBar' }).exists()).toBe(false)
  })

  it('投票失败时显示错误提示', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore(pinia)
    authStore.token = 'token'
    authStore.user = { uuid: 'reader-1', username: 'reader', role: 'user' } as never
    authStore.isAuthenticated = true
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/posts', component: { template: '<div />' } }],
    })
    await router.push('/posts')
    await router.isReady()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/vote') && init?.method === 'PUT') throw new Error('network down')
      return response({
        id: 'note-1', user_id: 'user-1', content: '内容', created_at: '2026-07-01T00:00:00Z',
        media: [], likes_count: 3, dislikes_count: 1, viewer_vote: 'none', comments_count: 2,
      })
    }))

    const wrapper = mount(ShortNoteSheet, {
      props: { layer },
      global: {
        plugins: [router, pinia],
        stubs: {
          PSheet: { template: '<section><slot /></section>' },
          PInteractionActions: { props: ['liked', 'likeCount', 'disliked', 'dislikeCount'], emits: ['like-change'], template: '<button data-test="note-vote" @click="$emit(\'like-change\', true)" />' },
          PImageLightbox: true,
          CommentSideSheet: true,
        },
      },
    })
    await flushPromises()
    await wrapper.get('[data-test="note-vote"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('投票失败')
  })
})
