import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PodcastEditorView from '@/views/podcast/PodcastEditorView.vue'
import { useAuthStore } from '@/stores/auth'

const makeJsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

function setAuthenticatedUser() {
  const auth = useAuthStore()
  auth.token = 'token'
  auth.user = { id: 'user-1', uuid: 'user-1', username: 'demo', role: 'user' } as never
  auth.isAuthenticated = true
}

async function mountEditor(fetchMock: ReturnType<typeof vi.fn>, path = '/podcasts/editor') {
  vi.stubGlobal('fetch', fetchMock)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/podcasts/editor/:id?', component: PodcastEditorView },
      { path: '/podcasts/episode/:id', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  setAuthenticatedUser()

  const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
  await flushPromises()
  const editor = wrapper.findComponent(PodcastEditorView)
  editor.vm.$.setupState.form.channel_id = 'channel-1'
  editor.vm.$.setupState.form.title = '待发布单集'
  editor.vm.$.setupState.form.audio_url = '/audio/episode.mp3'
  editor.vm.$.setupState.requestPublish()
  return { editor, router }
}

describe('PodcastEditorView 发布流程', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('发布失败时保留确认框、表单和后端错误', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?')) return makeJsonResponse({ data: [] })
      if (url.endsWith('/users/me/default-channels')) return makeJsonResponse({ data: { podcast: null } })
      if (url.endsWith('/podcast/episodes') && init?.method === 'POST') {
        return makeJsonResponse({ error: '频道类型不匹配' }, 400)
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    const { editor } = await mountEditor(fetchMock)

    await editor.vm.$.setupState.doPublish()

    expect(editor.vm.$.setupState.showPublishConfirm).toBe(true)
    expect(editor.vm.$.setupState.form.title).toBe('待发布单集')
    expect(editor.vm.$.setupState.errorMsg).toBe('频道类型不匹配')
  })

  it('发布请求进行中忽略重复确认和取消', async () => {
    let resolvePublish!: (response: Response) => void
    const publishResponse = new Promise<Response>((resolve) => { resolvePublish = resolve })
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?')) return Promise.resolve(makeJsonResponse({ data: [] }))
      if (url.endsWith('/users/me/default-channels')) return Promise.resolve(makeJsonResponse({ data: { podcast: null } }))
      if (url.endsWith('/podcast/episodes') && init?.method === 'POST') return publishResponse
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })
    const { editor } = await mountEditor(fetchMock)

    const firstPublish = editor.vm.$.setupState.doPublish()
    const duplicatePublish = editor.vm.$.setupState.doPublish()
    editor.findComponent({ name: 'PConfirm' }).vm.$emit('cancel')
    await editor.vm.$nextTick()

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
    expect(editor.vm.$.setupState.showPublishConfirm).toBe(true)
    expect(editor.findComponent({ name: 'PConfirm' }).props('confirmText')).toBe('发布中...')

    resolvePublish(makeJsonResponse({ id: 'episode-1' }))
    await Promise.all([firstPublish, duplicatePublish])
  })

  it('发布成功但导航失败时重试只导航，不重复创建单集', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?')) return makeJsonResponse({ data: [] })
      if (url.endsWith('/users/me/default-channels')) return makeJsonResponse({ data: { podcast: null } })
      if (url.endsWith('/podcast/episodes') && init?.method === 'POST') {
        return makeJsonResponse({ id: 'episode-1' }, 201)
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    const { editor, router } = await mountEditor(fetchMock)
    const removeGuard = router.beforeEach((to) => to.path.startsWith('/podcasts/episode/') ? false : true)

    await editor.vm.$.setupState.doPublish()

    expect(editor.vm.$.setupState.showPublishConfirm).toBe(true)
    expect(editor.vm.$.setupState.errorMsg).toBe('单集已发布，但跳转失败，请重试')

    removeGuard()
    await editor.vm.$.setupState.doPublish()

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
    expect(router.currentRoute.value.fullPath).toBe('/podcasts/episode/episode-1')
  })

  it('导航失败后禁止取消和保存草稿，避免再次创建单集', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?')) return makeJsonResponse({ data: [] })
      if (url.endsWith('/users/me/default-channels')) return makeJsonResponse({ data: { podcast: null } })
      if (url.endsWith('/podcast/episodes') && init?.method === 'POST') {
        return makeJsonResponse({ id: 'episode-1' }, 201)
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    const { editor, router } = await mountEditor(fetchMock)
    router.beforeEach((to) => to.path.startsWith('/podcasts/episode/') ? false : true)
    await editor.vm.$.setupState.doPublish()

    editor.findComponent({ name: 'PConfirm' }).vm.$emit('cancel')
    await editor.vm.$nextTick()
    expect(editor.vm.$.setupState.showPublishConfirm).toBe(true)

    await editor.vm.$.setupState.saveDraft()

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
    expect(editor.vm.$.setupState.showPublishConfirm).toBe(true)
    expect(editor.vm.$.setupState.errorMsg).toBe('单集已发布，但跳转失败，请重试')
  })

  it('导航 Promise reject 后保留已发布状态且重试只导航', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?')) return makeJsonResponse({ data: [] })
      if (url.endsWith('/users/me/default-channels')) return makeJsonResponse({ data: { podcast: null } })
      if (url.endsWith('/podcast/episodes') && init?.method === 'POST') {
        return makeJsonResponse({ id: 'episode-1' }, 201)
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    const { editor, router } = await mountEditor(fetchMock)
    const pushSpy = vi.spyOn(router, 'push')
      .mockRejectedValueOnce(new Error('navigation failed'))
      .mockResolvedValueOnce(undefined)

    await editor.vm.$.setupState.doPublish()
    expect(editor.vm.$.setupState.showPublishConfirm).toBe(true)
    expect(editor.vm.$.setupState.errorMsg).toBe('单集已发布，但跳转失败，请重试')

    await editor.vm.$.setupState.doPublish()

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
    expect(pushSpy).toHaveBeenCalledTimes(2)
    expect(pushSpy).toHaveBeenLastCalledWith('/podcasts/episode/episode-1')
  })

  it('编辑路由发布只 PUT 一次并使用路由 ID 导航', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?')) return makeJsonResponse({ data: [] })
      if (url.endsWith('/users/me/default-channels')) return makeJsonResponse({ data: { podcast: null } })
      if (url.endsWith('/blog/channels/channel-1/collections')) return makeJsonResponse({ data: [] })
      if (url.endsWith('/podcast/episodes/edit-episode') && !init?.method) {
        return makeJsonResponse({
          id: 'edit-episode',
          channel_id: 'channel-1',
          audio_url: '/audio/episode.mp3',
          episode_cover_url: '',
          season_number: 1,
          episode_number: 1,
          post: { title: '待编辑单集', content: '' },
        })
      }
      if (url.endsWith('/podcast/episodes/edit-episode') && init?.method === 'PUT') {
        return makeJsonResponse({ id: 'response-id-must-not-be-used' })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    const { editor, router } = await mountEditor(fetchMock, '/podcasts/editor/edit-episode')

    await editor.vm.$.setupState.doPublish()

    const putCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')
    expect(putCalls).toHaveLength(1)
    expect(String(putCalls[0]?.[0])).toMatch(/\/podcast\/episodes\/edit-episode$/)
    expect(router.currentRoute.value.fullPath).toBe('/podcasts/episode/edit-episode')
  })
})
