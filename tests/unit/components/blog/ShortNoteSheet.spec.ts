import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

// @ts-expect-error Vitest resolves Vue SFC imports through Vite.
import ShortNoteSheet from '../../../../src/components/blog/ShortNoteSheet.vue'
import type { ShortNoteLayer } from '../../../../src/components/blog/blogSheetTypes'

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
})
