import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import ShortNoteComposerView from '@/views/blog/ShortNoteComposerView.vue'
import { useAuthStore } from '@/stores/auth'
import { useDraftStagingStore } from '@/stores/draftStaging'

describe('ShortNoteComposerView', () => {
  it('无权编辑时不显示可提交的编辑器', async () => {
    const pinia = createPinia()
    const authStore = useAuthStore(pinia)
    authStore.user = { uuid: 'viewer', username: 'viewer', role: 'user' } as never
    authStore.isAuthenticated = true
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: {
      id: 'note-1', user_id: 'owner', content: '他人的短笺', media: [], created_at: '2026-07-01T00:00:00Z',
    } }), { status: 200 })))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/posts/notes/:id/edit', component: ShortNoteComposerView }],
    })
    await router.push('/posts/notes/note-1/edit')
    await router.isReady()

    const wrapper = mount(ShortNoteComposerView, {
      global: {
        plugins: [router, pinia],
        stubs: {
          RouterLink: true,
          PPageHeader: true,
          ShortNoteComposer: { template: '<div data-test="composer" />' },
        },
      },
    })
    await flushPromises()

    expect(wrapper.find('[data-test="composer"]').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('无权编辑')
  })

  it('预填来自图书划线的暂存引用内容', async () => {
    const pinia = createPinia()
    const draftStore = useDraftStagingStore(pinia)
    draftStore.setPendingQuote({
      sourceType: 'book_annotation',
      annotationId: 'ann-1',
      assetId: 'asset-1',
      bookTitle: '百年孤独',
      quoteText: '生命中真正重要的不是你遭遇了什么',
      personalNote: '读后随感',
      target: 'short_note',
      mode: 'replace',
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/posts/notes/new', component: ShortNoteComposerView }],
    })
    await router.push('/posts/notes/new')
    await router.isReady()

    const wrapper = mount(ShortNoteComposerView, {
      global: {
        plugins: [router, pinia],
        stubs: {
          RouterLink: true,
          PPageHeader: true,
          ShortNoteComposer: {
            props: ['initialContent'],
            template: '<div data-test="composer" :data-initial="initialContent" />',
          },
        },
      },
    })
    await flushPromises()

    const composer = wrapper.get('[data-test="composer"]')
    expect(composer.attributes('data-initial')).toContain('读后随感')
    expect(composer.attributes('data-initial')).toContain('「生命中真正重要的不是你遭遇了什么」——《百年孤独》')
    expect(draftStore.pendingQuote).toBeNull()
  })
})
