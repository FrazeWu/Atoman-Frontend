import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h, nextTick } from 'vue'

import PostEditorView from '@/views/blog/PostEditorView.vue'
import { useAuthStore } from '@/stores/auth'
import { useStudioStore } from '@/stores/studio'

const editorControl = {
  lastModelValue: '',
  replaceDocument: vi.fn(),
  emitCollabReady: null as null | ((markdown: string) => Promise<void>),
  emitUpdateModel: null as null | ((markdown: string) => Promise<void>),
  reset() {
    this.lastModelValue = ''
    this.replaceDocument.mockReset()
    this.emitCollabReady = null
    this.emitUpdateModel = null
  },
}

vi.mock('@/components/shared/PEditor.vue', () => ({
  default: defineComponent({
    name: 'PEditor',
    props: {
      modelValue: {
        type: String,
        default: '',
      },
      mode: {
        type: String,
        default: 'normal',
      },
      showModeToggle: {
        type: Boolean,
        default: false,
      },
      enableCollab: {
        type: Boolean,
        default: false,
      },
      collabRoomId: {
        type: String,
        default: undefined,
      },
    },
    emits: ['update:modelValue', 'active-heading-change', 'collab-ready', 'mode-change'],
    setup(props, { emit, expose }) {
      expose({
        replaceDocument: editorControl.replaceDocument,
      })

      editorControl.emitCollabReady = async (markdown: string) => {
        emit('collab-ready', markdown)
        await nextTick()
      }

      editorControl.emitUpdateModel = async (markdown: string) => {
        emit('update:modelValue', markdown)
        await nextTick()
      }

      return () => {
        editorControl.lastModelValue = props.modelValue
        return h('div', {
          class: 'editor-stub',
          'data-model-value': props.modelValue,
          'data-mode': props.mode,
          'data-show-mode-toggle': String(props.showModeToggle),
          'data-enable-collab': String(props.enableCollab),
          'data-collab-room-id': props.collabRoomId,
        }, props.modelValue)
      }
    },
  }),
}))

const makeJsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('PostEditorView', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    const studio = useStudioStore()
    studio.loaded = true
    studio.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
    studio.channels = [studio.currentChannel]
    studio.collections.blog = [
      { id: 'collection-1', channel_id: 'channel-1', content_type: 'blog', name: '默认合集', description: '', cover_url: '', is_default: true, created_at: '', updated_at: '' },
      { id: 'collection-2', channel_id: 'channel-1', content_type: 'blog', name: '专题合集', description: '', cover_url: '', is_default: false, created_at: '', updated_at: '' },
      { id: 'collection-3', channel_id: 'channel-1', content_type: 'blog', name: '查询参数合集', description: '', cover_url: '', is_default: false, created_at: '', updated_at: '' },
    ]
    vi.spyOn(studio, 'loadCollections').mockResolvedValue()
	vi.spyOn(studio, 'loadSettings').mockResolvedValue()
    editorControl.reset()
    vi.useRealTimers()
  })

  it('按当前频道请求合集', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts/post/new', component: PostEditorView },
      ],
    })

    await router.push('/posts/post/new?channel=channel-2')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) {
        return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })
      }

      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.includes('/blog/channels/channel-2/collections')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.includes('/blog/drafts?context_key=')) {
        return makeJsonResponse({ data: null })
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
        stubs: {
          PButton: { template: '<button><slot /></button>' },
          PModal: { template: '<div><slot /><slot name="footer" /></div>' },
        },
      },
    })

    await flushPromises()

    expect(useStudioStore().loadCollections).toHaveBeenCalledWith('blog')
    expect(router.currentRoute.value.query.channel).toBe('channel-2')
  })

  it('新建文章补默认频道时，应保留已注册的编辑器路由前缀', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts/post/new', component: PostEditorView },
      ],
    })

    await router.push('/posts/post/new')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) {
        return makeJsonResponse({
          data: {
            blog: { id: 'channel-2', name: '默认博客频道', slug: 'channel-2' },
            podcast: null,
            video: null,
          },
        })
      }

      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [{ id: 'channel-1' }, { id: 'channel-2' }] })
      }
      if (url.includes('/blog/channels/channel-2/collections')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.includes('/blog/drafts?context_key=')) {
        return makeJsonResponse({ data: null })
      }

      throw new Error(`unexpected fetch: ${url}`)
    }))

    mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
        stubs: {
          PButton: { template: '<button><slot /></button>' },
          PModal: { template: '<div><slot /><slot name="footer" /></div>' },
        },
      },
    })

    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/posts/post/new')
  })

  it('新建文章应在合法频道下恢复 query.collection', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts/post/new', component: PostEditorView },
      ],
    })

    await router.push('/posts/post/new?channel=channel-2&collection=collection-2')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) {
        return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })
      }

      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [{ id: 'channel-2', name: '频道 2' }] })
      }
      if (url.includes('/blog/channels/channel-2/collections')) {
        return makeJsonResponse({
          data: [
            { id: 'collection-1', name: '合集 1', channel_id: 'channel-2', is_default: true },
            { id: 'collection-2', name: '合集 2', channel_id: 'channel-2', is_default: false },
          ],
        })
      }
      if (url.includes('/blog/drafts?context_key=')) {
        return makeJsonResponse({ data: null })
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
        stubs: {
          PButton: { template: '<button><slot /></button>' },
          PModal: { template: '<div><slot /><slot name="footer" /></div>' },
        },
      },
    })

    await flushPromises()

    const editorView = wrapper.findComponent(PostEditorView)
    expect(editorView.vm.$.setupState.selectedCollectionIds).toEqual(['collection-1', 'collection-2'])
  })

  it('新建文章不得恢复不属于当前频道的非法 query.collection', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts/post/new', component: PostEditorView },
      ],
    })

    await router.push('/posts/post/new?channel=channel-2&collection=collection-x')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) {
        return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })
      }

      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [{ id: 'channel-2', name: '频道 2' }] })
      }
      if (url.includes('/blog/channels/channel-2/collections')) {
        return makeJsonResponse({
          data: [
            { id: 'collection-1', name: '合集 1', channel_id: 'channel-2', is_default: true },
            { id: 'collection-2', name: '合集 2', channel_id: 'channel-2', is_default: false },
          ],
        })
      }
      if (url.includes('/blog/drafts?context_key=')) {
        return makeJsonResponse({ data: null })
      }

      throw new Error(`unexpected fetch: ${url}`)
    }))

    const wrapper = mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
        stubs: {
          PButton: { template: '<button><slot /></button>' },
          PModal: { template: '<div><slot /><slot name="footer" /></div>' },
        },
      },
    })

    await flushPromises()

    const editorView = wrapper.findComponent(PostEditorView)
    expect(editorView.vm.$.setupState.selectedCollectionIds).toEqual(['collection-1'])
  })

  it('协作文档与草稿冲突时，显示冲突弹窗文案', async () => {
    localStorage.setItem('blog_editor_blog:post:post-1', JSON.stringify({
      payload: {
        context_key: 'blog:post:post-1',
        source_post_id: 'post-1',
        title: '本地标题',
        content: '本地正文',
        summary: '',
        cover_url: '',
        allow_comments: true,
        channel_id: 'channel-1',
        collection_ids: ['collection-1'],
      },
      saved_at: Date.parse('2026-05-19T10:00:00.000Z'),
    }))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts/post/:id/edit', component: PostEditorView },
      ],
    })

    await router.push('/posts/post/post-1/edit?channel=channel-1')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) {
        return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })
      }

      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.includes('/blog/posts/post-1')) {
        return makeJsonResponse({
          data: {
            id: 'post-1',
            title: '远端标题',
            content: '远端正文',
            summary: '',
            cover_url: '',
            allow_comments: true,
            updated_at: '2026-05-19T09:00:00.000Z',
            channel_id: 'channel-1',
            collections: [{ id: 'collection-1', channel_id: 'channel-1' }],
          },
        })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({ data: [{ id: 'collection-1', name: '默认合集', channel_id: 'channel-1', is_default: true }] })
      }
      if (url.includes('/blog/drafts?context_key=')) {
        return makeJsonResponse({ data: null })
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
        stubs: {
          PButton: { template: '<button><slot /></button>' },
          PModal: { template: '<div><slot /><slot name="footer" /></div>' },
        },
      },
    })

    await flushPromises()
    await editorControl.emitCollabReady?.('# 远端标题\n远端正文')
    await flushPromises()

    expect(wrapper.text()).toContain('协作文档与草稿内容不一致')
    expect(wrapper.text()).toContain('保留协作文档')
    expect(wrapper.text()).toContain('恢复草稿')
  })

  it('选择保留协作文档后，不调用 replaceDocument，并保留共享文档内容', async () => {
    localStorage.setItem('blog_editor_blog:post:post-1', JSON.stringify({
      payload: {
        context_key: 'blog:post:post-1',
        source_post_id: 'post-1',
        title: '本地标题',
        content: '本地正文',
        summary: '',
        cover_url: '',
        allow_comments: true,
        channel_id: 'channel-1',
        collection_ids: ['collection-1'],
      },
      saved_at: Date.parse('2026-05-19T10:00:00.000Z'),
    }))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts/post/:id/edit', component: PostEditorView },
      ],
    })

    await router.push('/posts/post/post-1/edit?channel=channel-1')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })

      if (url.includes('/blog/channels?')) return makeJsonResponse({ data: [] })
      if (url.includes('/blog/posts/post-1')) {
        return makeJsonResponse({
          data: {
            id: 'post-1',
            title: '远端标题',
            content: '远端正文',
            summary: '',
            cover_url: '',
            allow_comments: true,
            updated_at: '2026-05-19T09:00:00.000Z',
            channel_id: 'channel-1',
            collections: [{ id: 'collection-1', channel_id: 'channel-1' }],
          },
        })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({ data: [{ id: 'collection-1', name: '默认合集', channel_id: 'channel-1', is_default: true }] })
      }
      if (url.includes('/blog/drafts?context_key=')) return makeJsonResponse({ data: null })

      throw new Error(`unexpected fetch: ${url}`)
    }))

    const wrapper = mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
        stubs: {
          PButton: { template: '<button><slot /></button>' },
          PModal: { template: '<div><slot /><slot name="footer" /></div>' },
        },
      },
    })

    await flushPromises()
    await editorControl.emitCollabReady?.('# 远端标题\n远端正文')
    await flushPromises()

    const buttons = wrapper.findAll('button')
    const keepButton = buttons.find(button => button.text() === '保留协作文档')
    expect(keepButton).toBeTruthy()

    await keepButton!.trigger('click')
    await flushPromises()

    expect(editorControl.replaceDocument).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('远端标题')
    expect(wrapper.text()).toContain('远端正文')
  })

  it('选择恢复草稿后，调用 replaceDocument，把草稿内容写回协作文档', async () => {
    localStorage.setItem('blog_editor_blog:post:post-1', JSON.stringify({
      payload: {
        context_key: 'blog:post:post-1',
        source_post_id: 'post-1',
        title: '本地标题',
        content: '本地正文',
        summary: '',
        cover_url: '',
        allow_comments: true,
        channel_id: 'channel-1',
        collection_ids: ['collection-1'],
      },
      saved_at: Date.parse('2026-05-19T10:00:00.000Z'),
    }))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts/post/:id/edit', component: PostEditorView },
      ],
    })

    await router.push('/posts/post/post-1/edit?channel=channel-1')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })

      if (url.includes('/blog/channels?')) return makeJsonResponse({ data: [] })
      if (url.includes('/blog/posts/post-1')) {
        return makeJsonResponse({
          data: {
            id: 'post-1',
            title: '远端标题',
            content: '远端正文',
            summary: '',
            cover_url: '',
            allow_comments: true,
            updated_at: '2026-05-19T09:00:00.000Z',
            channel_id: 'channel-1',
            collections: [{ id: 'collection-1', channel_id: 'channel-1' }],
          },
        })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({ data: [{ id: 'collection-1', name: '默认合集', channel_id: 'channel-1', is_default: true }] })
      }
      if (url.includes('/blog/drafts?context_key=')) return makeJsonResponse({ data: null })

      throw new Error(`unexpected fetch: ${url}`)
    }))

    const wrapper = mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
        stubs: {
          PButton: { template: '<button><slot /></button>' },
          PModal: { template: '<div><slot /><slot name="footer" /></div>' },
        },
      },
    })

    await flushPromises()
    await editorControl.emitCollabReady?.('# 远端标题\n远端正文')
    await flushPromises()

    const buttons = wrapper.findAll('button')
    const restoreButton = buttons.find(button => button.text() === '恢复草稿')
    expect(restoreButton).toBeTruthy()

    await restoreButton!.trigger('click')
    await flushPromises()

    expect(editorControl.replaceDocument).toHaveBeenCalledWith('# 本地标题\n本地正文')
    expect(wrapper.text()).toContain('本地标题')
    expect(wrapper.text()).toContain('本地正文')
    expect(wrapper.text()).not.toContain('协作文档与草稿内容不一致')
  })

  it('编辑态在协作未 ready 前，仍然会保存本地草稿', async () => {
    vi.useFakeTimers()

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts/post/:id/edit', component: PostEditorView },
      ],
    })

    await router.push('/posts/post/post-1/edit?channel=channel-1')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })

      if (url.includes('/blog/channels?')) return makeJsonResponse({ data: [] })
      if (url.includes('/blog/posts/post-1')) {
        return makeJsonResponse({
          data: {
            id: 'post-1',
            title: '远端标题',
            content: '远端正文',
            summary: '',
            cover_url: '',
            allow_comments: true,
            updated_at: '2026-05-19T09:00:00.000Z',
            channel_id: 'channel-1',
            collections: [{ id: 'collection-1', channel_id: 'channel-1' }],
          },
        })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({ data: [{ id: 'collection-1', name: '默认合集', channel_id: 'channel-1', is_default: true }] })
      }
      if (url.includes('/blog/drafts?context_key=')) return makeJsonResponse({ data: null })

      throw new Error(`unexpected fetch: ${url}`)
    }))

    mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
        stubs: {
          PButton: { template: '<button><slot /></button>' },
          PModal: { template: '<div><slot /><slot name="footer" /></div>' },
        },
      },
    })

    await flushPromises()
    await editorControl.emitUpdateModel?.('# 修改后的标题\n修改后的正文')
    vi.advanceTimersByTime(600)
    await flushPromises()

    const savedDraft = JSON.parse(localStorage.getItem('blog_editor_blog:post:post-1') || 'null')
    expect(savedDraft?.payload.title).toBe('修改后的标题')
    expect(savedDraft?.payload.content).toBe('修改后的正文')
  })

  it('协作文档与草稿等价时不应弹冲突窗', async () => {
    localStorage.setItem('blog_editor_blog:post:post-1', JSON.stringify({
      payload: {
        context_key: 'blog:post:post-1',
        source_post_id: 'post-1',
        title: '本地标题',
        content: '本地正文',
        summary: '',
        cover_url: '',
        allow_comments: true,
        channel_id: 'channel-1',
        collection_ids: ['collection-1'],
      },
      saved_at: Date.parse('2026-05-19T10:00:00.000Z'),
    }))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts/post/:id/edit', component: PostEditorView },
      ],
    })

    await router.push('/posts/post/post-1/edit?channel=channel-1')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })

      if (url.includes('/blog/channels?')) return makeJsonResponse({ data: [] })
      if (url.includes('/blog/posts/post-1')) {
        return makeJsonResponse({
          data: {
            id: 'post-1',
            title: '远端标题',
            content: '远端正文',
            summary: '',
            cover_url: '',
            allow_comments: true,
            updated_at: '2026-05-19T09:00:00.000Z',
            channel_id: 'channel-1',
            collections: [{ id: 'collection-1', channel_id: 'channel-1' }],
          },
        })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({ data: [{ id: 'collection-1', name: '默认合集', channel_id: 'channel-1', is_default: true }] })
      }
      if (url.includes('/blog/drafts?context_key=')) return makeJsonResponse({ data: null })

      throw new Error(`unexpected fetch: ${url}`)
    }))

    const wrapper = mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
        stubs: {
          PButton: { template: '<button><slot /></button>' },
          PModal: { template: '<div><slot /><slot name="footer" /></div>' },
        },
      },
    })

    await flushPromises()
    await editorControl.emitCollabReady?.('## 本地标题\n本地正文\n')
    await flushPromises()

    expect(wrapper.text()).not.toContain('协作文档与草稿内容不一致')
    expect(editorControl.replaceDocument).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('本地标题')
    expect(wrapper.text()).toContain('本地正文')
  })

  it('编辑已有文章且真实启用协作连接时，显示专业模式提示', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts/post/:id/edit', component: PostEditorView },
      ],
    })

    await router.push('/posts/post/post-1/edit?channel=channel-1')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })

      if (url.includes('/blog/channels?')) return makeJsonResponse({ data: [] })
      if (url.includes('/blog/posts/post-1')) {
        return makeJsonResponse({
          data: {
            id: 'post-1',
            title: '远端标题',
            content: '远端正文',
            summary: '',
            cover_url: '',
            allow_comments: true,
            updated_at: '2026-05-19T09:00:00.000Z',
            channel_id: 'channel-1',
            collections: [{ id: 'collection-1', channel_id: 'channel-1' }],
          },
        })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({ data: [{ id: 'collection-1', name: '默认合集', channel_id: 'channel-1', is_default: true }] })
      }
      if (url.includes('/blog/drafts?context_key=')) return makeJsonResponse({ data: null })

      throw new Error(`unexpected fetch: ${url}`)
    }))

    const wrapper = mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
        stubs: {
          PButton: { template: '<button><slot /></button>' },
          PModal: { template: '<div><slot /><slot name="footer" /></div>' },
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('协作编辑请使用专业模式')
  })

  it('编辑已有文章且真实启用协作连接时，不暴露普通模式入口', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts/post/:id/edit', component: PostEditorView },
      ],
    })

    await router.push('/posts/post/post-1/edit?channel=channel-1')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })

      if (url.includes('/blog/channels?')) return makeJsonResponse({ data: [] })
      if (url.includes('/blog/posts/post-1')) {
        return makeJsonResponse({
          data: {
            id: 'post-1',
            title: '远端标题',
            content: '远端正文',
            summary: '',
            cover_url: '',
            allow_comments: true,
            updated_at: '2026-05-19T09:00:00.000Z',
            channel_id: 'channel-1',
            collections: [{ id: 'collection-1', channel_id: 'channel-1' }],
          },
        })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({ data: [{ id: 'collection-1', name: '默认合集', channel_id: 'channel-1', is_default: true }] })
      }
      if (url.includes('/blog/drafts?context_key=')) return makeJsonResponse({ data: null })

      throw new Error(`unexpected fetch: ${url}`)
    }))

    const wrapper = mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
        stubs: {
          PButton: { template: '<button><slot /></button>' },
          PModal: { template: '<div><slot /><slot name="footer" /></div>' },
        },
      },
    })

    await flushPromises()

    const editorStub = wrapper.find('.editor-stub')
    expect(editorStub.attributes('data-enable-collab')).toBe('true')
    expect(editorStub.attributes('data-collab-room-id')).toBe('post-1')
    expect(editorStub.attributes('data-show-mode-toggle')).toBe('false')
  })

  it('协作文档为空时应自动把草稿写回共享文档', async () => {
    localStorage.setItem('blog_editor_blog:post:post-1', JSON.stringify({
      payload: {
        context_key: 'blog:post:post-1',
        source_post_id: 'post-1',
        title: '本地标题',
        content: '本地正文',
        summary: '',
        cover_url: '',
        allow_comments: true,
        channel_id: 'channel-1',
        collection_ids: ['collection-1'],
      },
      saved_at: Date.parse('2026-05-19T10:00:00.000Z'),
    }))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/post/:id/edit', component: PostEditorView },
      ],
    })

    await router.push('/post/post-1/edit?channel=channel-1')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })

      if (url.includes('/blog/channels?')) return makeJsonResponse({ data: [] })
      if (url.includes('/blog/posts/post-1')) {
        return makeJsonResponse({
          data: {
            id: 'post-1',
            title: '',
            content: '',
            summary: '',
            cover_url: '',
            allow_comments: true,
            updated_at: '2026-05-19T09:00:00.000Z',
            channel_id: 'channel-1',
            collections: [{ id: 'collection-1', channel_id: 'channel-1' }],
          },
        })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({ data: [{ id: 'collection-1', name: '默认合集', channel_id: 'channel-1', is_default: true }] })
      }
      if (url.includes('/blog/drafts?context_key=')) return makeJsonResponse({ data: null })

      throw new Error(`unexpected fetch: ${url}`)
    }))

    const wrapper = mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
        stubs: {
          PButton: { template: '<button><slot /></button>' },
          PModal: { template: '<div><slot /><slot name="footer" /></div>' },
        },
      },
    })

    await flushPromises()
    await editorControl.emitCollabReady?.('')
    await flushPromises()

    expect(editorControl.replaceDocument).toHaveBeenCalledWith('# 本地标题\n本地正文')
    expect(wrapper.text()).toContain('本地标题')
    expect(wrapper.text()).toContain('本地正文')
    expect(wrapper.text()).not.toContain('协作文档与草稿内容不一致')
  })

  it('编辑已有文章保存时，会提交当前频道和合集', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts/post/:id/edit', component: PostEditorView },
        { path: '/posts/post/:id', component: { template: '<div>detail</div>' } },
      ],
    })

    await router.push('/posts/post/post-1/edit?channel=channel-1')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })

      if (url.includes('/blog/channels?')) return makeJsonResponse({ data: [] })
      if (url.includes('/blog/posts/post-1') && (!init?.method || init.method === 'GET')) {
        return makeJsonResponse({
          data: {
            id: 'post-1',
            title: '远端标题',
            content: '远端正文',
            summary: '',
            cover_url: '',
            visibility: 'public',
            allow_comments: true,
            updated_at: '2026-05-19T09:00:00.000Z',
            channel_id: 'channel-1',
            collections: [
              { id: 'collection-1', channel_id: 'channel-1' },
              { id: 'collection-2', channel_id: 'channel-1' },
            ],
          },
        })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({
          data: [
            { id: 'collection-1', name: '默认合集', channel_id: 'channel-1', is_default: true },
            { id: 'collection-2', name: '专题合集', channel_id: 'channel-1', is_default: false },
          ],
        })
      }
      if (url.includes('/blog/drafts?context_key=')) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
      if (url.includes('/blog/posts/post-1') && init?.method === 'PUT') {
        return makeJsonResponse({ data: { id: 'post-1' } })
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
        stubs: {
          PButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
          PModal: { template: '<div><slot /><slot name="footer" /></div>' },
        },
      },
    })

    await flushPromises()
    await editorControl.emitCollabReady?.('# 远端标题\n远端正文')
    await flushPromises()

    const saveButton = wrapper.findAll('button').find(button => button.text() === '存草稿')
    expect(saveButton).toBeTruthy()
    await saveButton!.trigger('click')
    await flushPromises()

    const putCall = fetchMock.mock.calls.find(([input, init]) => String(input).includes('/blog/posts/post-1') && init?.method === 'PUT')
    expect(putCall).toBeTruthy()
    const body = JSON.parse(String(putCall?.[1]?.body ?? '{}'))
    expect(body.channel_id).toBe('channel-1')
    expect(body.collection_id).toBe('collection-2')
    expect(body).not.toHaveProperty('collection_ids')
    expect(router.currentRoute.value.fullPath).toBe('/studio/blog/content?collection_id=collection-2')
  })

  it('应当根据 URL 查询参数初始化合集和频道', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts/post/new', component: PostEditorView },
      ],
    })

    await router.push('/posts/post/new?channel=channel-2&collection=collection-3')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) {
        return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })
      }
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [{ id: 'channel-2' }] })
      }
      if (url.includes('/blog/channels/channel-2/collections')) {
        return makeJsonResponse({ 
          data: [
            { id: 'collection-1', name: '默认合集', channel_id: 'channel-2', is_default: true },
            { id: 'collection-3', name: '查询参数合集', channel_id: 'channel-2', is_default: false }
          ] 
        })
      }
      if (url.includes('/blog/drafts?context_key=')) {
        return makeJsonResponse({ data: null })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
        stubs: {
          PButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
          PModal: { template: '<div><slot /><slot name="footer" /></div>' },
          PSheet: { template: '<div><slot /></div>' },
          PPress: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
          PEditor: { template: '<div class="editor-stub"></div>' },
        },
      },
    })

    await flushPromises()
    await nextTick()

    expect(useStudioStore().loadCollections).toHaveBeenCalledWith('blog')

    const editorView = wrapper.findComponent(PostEditorView)
    expect(editorView.vm.$.setupState.selectedCollectionIds).toEqual(['collection-1', 'collection-3'])
  })

  it('使用 Studio 当前频道和合集预选，草稿保存后返回内容管理', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/studio/blog/new', component: PostEditorView },
        { path: '/studio/blog/content', component: { template: '<div />' } },
      ],
    })
    await router.push('/studio/blog/new?collection=collection-2')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true
    const studio = useStudioStore()
    studio.loaded = true
    studio.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
    studio.channels = [studio.currentChannel]
    studio.collections.blog = [
      { id: 'collection-1', channel_id: 'channel-1', content_type: 'blog', name: '默认合集', description: '', cover_url: '', is_default: true, created_at: '', updated_at: '' },
      { id: 'collection-2', channel_id: 'channel-1', content_type: 'blog', name: '专题', description: '', cover_url: '', is_default: false, created_at: '', updated_at: '' },
    ]
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })
      if (url.includes('/blog/channels?')) return makeJsonResponse({ data: [] })
      if (url.includes('/blog/drafts?context_key=')) return makeJsonResponse({ data: null })
      if (url.endsWith('/blog/posts') && init?.method === 'POST') return makeJsonResponse({ data: { id: 'post-1' } })
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount({ template: '<router-view />' }, {
      global: {
        plugins: [router],
        stubs: {
          PButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
          PModal: { template: '<div><slot /><slot name="footer" /></div>' },
        },
      },
    })
    await flushPromises()

    const editorView = wrapper.findComponent(PostEditorView)
    expect(editorView.vm.$.setupState.currentChannelId).toBe('channel-1')
    expect(editorView.vm.$.setupState.selectedCollectionIds).toEqual(['collection-1', 'collection-2'])
    editorView.vm.$.setupState.form.title = 'Studio 草稿'
    editorView.vm.$.setupState.form.content = '正文'
    await editorView.vm.$.setupState.save('draft')
    await flushPromises()

    const postCall = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith('/blog/posts') && init?.method === 'POST')
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({ channel_id: 'channel-1', status: 'draft' })
    expect(router.currentRoute.value.fullPath).toBe('/studio/blog/content?collection_id=collection-2')
  })

  it('新文章应用 Studio 创作默认值', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/studio/blog/new', component: PostEditorView }] })
    await router.push('/studio/blog/new')
    await router.isReady()
    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true
    const studio = useStudioStore()
    studio.settings.blog = {
      channel_id: 'channel-1', module: 'blog', default_collection_id: 'collection-2',
      default_visibility: 'private', default_publish_status: 'draft', autoplay_enabled: false,
    }
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/blog/drafts?context_key=')) return makeJsonResponse({ data: null })
      throw new Error(`unexpected fetch: ${String(input)}`)
    }))

    const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
    await flushPromises()
    const editor = wrapper.findComponent(PostEditorView)
    expect(studio.loadSettings).toHaveBeenCalledWith('blog')
    expect(editor.vm.$.setupState.form.visibility).toBe('private')
    expect(editor.vm.$.setupState.selectedCollectionIds).toEqual(['collection-1', 'collection-2'])
    expect(editor.vm.$.setupState.preferredPublishStatus).toBe('draft')
  })

  it('发布文章遇到无效引用时显示候选选择提示', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/studio/blog/new', component: PostEditorView }],
    })
    await router.push('/studio/blog/new')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/blog/posts') && init?.method === 'POST') {
        return new Response(JSON.stringify({
          error: { code: 'reference.invalid_syntax', message: 'Reference syntax is invalid' },
        }), { status: 400 })
      }
      if (url.includes('/blog/drafts?context_key=')) return makeJsonResponse({ data: null })
      return makeJsonResponse({ data: null })
    }))

    const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
    await flushPromises()
    const editor = wrapper.findComponent(PostEditorView)
    editor.vm.$.setupState.form.title = '文章'
    editor.vm.$.setupState.form.content = '@post:not-a-uuid'

    await editor.vm.$.setupState.save('published')

    expect(editor.vm.$.setupState.error).toBe('请从候选中选择有效引用')
  })
})
