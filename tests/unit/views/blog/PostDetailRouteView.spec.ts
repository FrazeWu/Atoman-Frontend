import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

// @ts-expect-error Vitest resolves Vue SFC imports through Vite, outside tsconfig's src-only include.
import PostDetailRouteView from '../../../../src/views/blog/PostDetailRouteView.vue'
import { useBlogSheets } from '../../../../src/composables/useBlogSheets'

describe('PostDetailRouteView', () => {
  beforeEach(() => useBlogSheets().closeAll())

  it('在桌面端将直达文章链接收敛为同一个文章弹层', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts', component: { template: '<div />' } },
        { path: '/posts/post/:id', component: PostDetailRouteView },
      ],
    })
    await router.push('/posts/post/post-1?source=continue')
    await router.isReady()

    mount(PostDetailRouteView, { global: { plugins: [router] } })
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/posts?source=continue')
    expect(useBlogSheets().layers.value).toEqual([
      expect.objectContaining({ kind: 'post', payload: { postId: 'post-1' } }),
    ])
  })
})
