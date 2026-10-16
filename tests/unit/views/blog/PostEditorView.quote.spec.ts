import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, enableAutoUnmount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PostEditorView from '@/views/blog/PostEditorView.vue'
import { useAuthStore } from '@/stores/auth'
import { useStudioStore } from '@/stores/studio'
import { useDraftStagingStore } from '@/stores/draftStaging'

enableAutoUnmount(afterEach)

const editorControl = {
  lastModelValue: '',
  replaceDocument: vi.fn(),
  reset() {
    this.lastModelValue = ''
    this.replaceDocument.mockReset()
  },
}

vi.mock('@/components/shared/PEditor.vue', () => ({
  default: defineComponent({
    name: 'PEditor',
    props: {
      modelValue: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    setup(props, { expose }) {
      expose({
        replaceDocument: editorControl.replaceDocument,
      })
      return () => {
        editorControl.lastModelValue = props.modelValue
        return h('div', { class: 'editor-stub' }, props.modelValue)
      }
    },
  }),
}))

const makeJsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('PostEditorView - Book Quote Ingestion', () => {
  let router: ReturnType<typeof createRouter>

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    editorControl.reset()

    const studio = useStudioStore()
    studio.loaded = true
    studio.currentChannel = {
      id: 'channel-1',
      name: '主频道',
      slug: 'main',
      description: '',
      cover_url: '',
    }
    studio.channels = [studio.currentChannel]
    studio.unifiedCollections = []
    studio.settings = {
      blog: {
        editor_mode: 'markdown',
      },
    } as any

    const auth = useAuthStore()
    auth.user = { uuid: 'author-1', username: 'author', role: 'admin' } as any
    auth.isAuthenticated = true

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/v1/user/channels/channel-1/collections')) {
          return makeJsonResponse([])
        }
        if (url.includes('/api/v1/user/posts/drafts/last')) {
          return makeJsonResponse(null)
        }
        return makeJsonResponse({})
      })
    )

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/studio/blog/editor', component: PostEditorView },
        { path: '/studio/blog/editor/:id', component: PostEditorView },
        { path: '/studio/content/blog', component: { template: '<div>List</div>' } },
      ],
    })
  })

  it('ingests staged book quote in replace mode and sets default title', async () => {
    const draftStore = useDraftStagingStore()
    draftStore.setPendingQuote({
      sourceType: 'book_annotation',
      annotationId: 'ann-1',
      assetId: 'asset-1',
      bookTitle: '百年孤独',
      bookAuthor: '马尔克斯',
      quoteText: '生命是一袭华美的袍，爬满了蚤子。',
      personalNote: '经典譬喻',
      target: 'blog_post',
      mode: 'replace',
    })

    await router.push('/studio/blog/editor')
    await router.isReady()

    const wrapper = mount(PostEditorView, {
      global: {
        plugins: [router],
        stubs: {
          PostEditorTopbar: true,
          PostEditorFormattingToolbar: true,
          PostPublicationSheet: true,
          PostEditorDraftRecoveryModal: true,
          PostVersionHistoryModal: true,
        },
      },
    })
    await flushPromises()

    expect(editorControl.lastModelValue).toContain('# 《百年孤独》读后感')
    expect(editorControl.lastModelValue).toContain('> 生命是一袭华美的袍，爬满了蚤子。')
    expect(editorControl.lastModelValue).toContain('> ——《百年孤独》 · 马尔克斯')
    expect(editorControl.lastModelValue).toContain('经典譬喻')
    expect(draftStore.pendingQuote).toBeNull()

    wrapper.unmount()
  })

  it('appends staged book quote to existing content when mode is append', async () => {
    // Pre-populate an existing draft in localStorage
    localStorage.setItem(
      'blog_editor_blog:new',
      JSON.stringify({
        payload: {
          title: '我的读书随笔',
          content: '这是已有的一段笔记正文。',
          summary: '',
          cover_url: '',
          visibility: 'public',
          tags: [],
          context_key: 'blog:new',
        },
        saved_at: Date.now(),
      })
    )

    const draftStore = useDraftStagingStore()
    draftStore.setPendingQuote({
      sourceType: 'book_annotation',
      annotationId: 'ann-2',
      assetId: 'asset-2',
      bookTitle: '三体',
      quoteText: '给岁月以文明。',
      target: 'blog_post',
      mode: 'append',
    })

    await router.push('/studio/blog/editor')
    await router.isReady()

    const wrapper = mount(PostEditorView, {
      global: {
        plugins: [router],
        stubs: {
          PostEditorTopbar: true,
          PostEditorFormattingToolbar: true,
          PostPublicationSheet: true,
          PostEditorDraftRecoveryModal: true,
          PostVersionHistoryModal: true,
        },
      },
    })
    await flushPromises()

    expect(editorControl.lastModelValue).toContain('# 我的读书随笔')
    expect(editorControl.lastModelValue).toContain('这是已有的一段笔记正文。')
    expect(editorControl.lastModelValue).toContain('> 给岁月以文明。')
    expect(editorControl.lastModelValue).toContain('> ——《三体》')
    expect(draftStore.pendingQuote).toBeNull()

    wrapper.unmount()
  })
})
