import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createRouter, createMemoryHistory, RouterLink } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import VideoDetailView from '@/views/video/VideoDetailView.vue'
import { useAuthStore } from '@/stores/auth'

const mocks = vi.hoisted(() => ({
  useInteractions: vi.fn(),
  interactions: {
    likeCount: { value: 0 },
    commentCount: { value: 0 },
    liked: { value: false },
    like: vi.fn(),
    unlike: vi.fn(),
  },
}))

vi.mock('@/composables/useInteractions', () => ({
  useInteractions: mocks.useInteractions,
}))

const InteractionBarStub = defineComponent({
  name: 'InteractionBar',
  props: ['liked', 'likeCount', 'commentCount', 'disabled'],
  emits: ['like', 'unlike'],
  setup(props) {
    return () => h('div', { 'data-test': 'interaction-bar' }, `喜欢 ${props.likeCount} 评论 ${props.commentCount}`)
  },
})

const CommentSectionStub = defineComponent({
  name: 'CommentSection',
  props: ['target', 'noun', 'currentTime', 'canDelete'],
  emits: ['seek', 'count-change'],
  template: '<section data-test="comment-section" />',
})

const PVideoPlayerShellStub = defineComponent({
  name: 'PVideoPlayerShell',
  template: '<section><slot name="player" /><slot name="timeline-preview" /><slot /></section>',
})

const VideoContinueListStub = defineComponent({
  name: 'VideoContinueList',
  props: ['videos'],
  template: '<aside>{{ videos.map((video) => video.title).join(",") }}</aside>',
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const makeJsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const makeVideo = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  user_id: 'user-1',
  channel_id: 'channel-1',
  description: '',
  video_url: `https://example.com/${id}.mp4`,
  storage_type: 'external',
  thumbnail_url: '',
  duration_sec: 0,
  visibility: 'public',
  status: 'published',
  view_count: 0,
  tags: [],
  created_at: '2026-06-30T00:00:00Z',
  updated_at: '2026-06-30T00:00:00Z',
  ...extra,
})

async function mountVideoDetail(path = '/videos/watch/video-1') {
  const pinia = createPinia()
  setActivePinia(pinia)

  const authStore = useAuthStore()
  authStore.isAuthenticated = true
  authStore.token = 'token-1'
  authStore.user = { uuid: 'user-2', username: 'reader', email: 'reader@example.com' }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/videos/watch/:id', component: VideoDetailView }],
  })
  await router.push(path)
  await router.isReady()

  const wrapper = mount(VideoDetailView, {
    global: {
      plugins: [pinia, router],
      stubs: {
        RouterLink,
        InteractionBar: InteractionBarStub,
        CommentSection: CommentSectionStub,
        PVideoPlayerShell: PVideoPlayerShellStub,
        VideoContinueList: VideoContinueListStub,
        VideoPlayerControls: { template: '<div />' },
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('VideoDetailView shared interactions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
    mocks.useInteractions.mockReturnValue(mocks.interactions)
    mocks.interactions.likeCount.value = 0
    mocks.interactions.commentCount.value = 0
    mocks.interactions.liked.value = false
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST' && url.endsWith('/view')) return makeJsonResponse({})
      if (url.endsWith('/videos/video-1')) {
        return makeJsonResponse(makeVideo('video-1', '当前视频', {
          liked: true,
          like_count: 6,
        }))
      }
      if (url.endsWith('/videos/video-1/recommended')) return makeJsonResponse([])
      throw new Error(`unexpected fetch: ${url}`)
    }))
  })

  it('渲染统一评论区，并用响应式 video id 初始化互动状态', async () => {
    const { wrapper } = await mountVideoDetail()

    expect(mocks.useInteractions).toHaveBeenCalledWith('videos', 'video', expect.any(Object))
    expect(mocks.useInteractions.mock.calls[0][2].value).toBe('video-1')
    expect(mocks.interactions.liked.value).toBe(true)
    expect(mocks.interactions.likeCount.value).toBe(6)
    expect(mocks.interactions.commentCount.value).toBe(0)
    expect(wrapper.find('[data-test="interaction-bar"]').exists()).toBe(true)
    const comments = wrapper.findComponent(CommentSectionStub)
    expect(comments.props('target')).toEqual({ kind: 'video', resourceId: 'video-1' })
    expect(comments.props('noun')).toBe('评论')
  })

  it('仅视频作者或版主可删除任意视频评论', async () => {
    const { wrapper } = await mountVideoDetail()
    const authStore = useAuthStore()
    const comments = wrapper.findComponent(CommentSectionStub)

    expect(comments.props('canDelete')).toBe(false)

    authStore.user = { uuid: 'user-1', username: 'author', email: 'author@example.com' }
    await nextTick()
    expect(comments.props('canDelete')).toBe(true)

    for (const role of ['moderator', 'admin', 'owner'] as const) {
      authStore.user = { uuid: 'user-2', username: role, email: `${role}@example.com`, role }
      await nextTick()
      expect(comments.props('canDelete')).toBe(true)
    }
  })

  it('路由 video id 切换后更新统一评论区 target', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST' && url.endsWith('/view')) return makeJsonResponse({})
      if (url.endsWith('/videos/video-1')) return makeJsonResponse(makeVideo('video-1', '第一个视频'))
      if (url.endsWith('/videos/video-1/recommended')) return makeJsonResponse([])
      if (url.endsWith('/videos/video-2')) return makeJsonResponse(makeVideo('video-2', '第二个视频'))
      if (url.endsWith('/videos/video-2/recommended')) return makeJsonResponse([])
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const { wrapper, router } = await mountVideoDetail()
    await router.push('/videos/watch/video-2')
    await flushPromises()

    expect(wrapper.findComponent(CommentSectionStub).props('target')).toEqual({ kind: 'video', resourceId: 'video-2' })
  })

  it('本地视频评论时间取整，并响应 seek 更新播放器时间', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST' && url.endsWith('/view')) return makeJsonResponse({})
      if (url.endsWith('/videos/video-1')) return makeJsonResponse(makeVideo('video-1', '本地视频', { storage_type: 'local' }))
      if (url.endsWith('/videos/video-1/recommended')) return makeJsonResponse([])
      throw new Error(`unexpected fetch: ${url}`)
    }))
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)

    const { wrapper } = await mountVideoDetail()
    expect(wrapper.get('video').attributes('controls')).toBeDefined()
    const video = wrapper.get('video').element as HTMLVideoElement
    Object.defineProperty(video, 'currentTime', { configurable: true, value: 12.8, writable: true })
    const comments = wrapper.findComponent(CommentSectionStub)
    const currentTime = comments.props('currentTime') as () => number | null

    expect(currentTime()).toBe(12)
    comments.vm.$emit('seek', 84)
    await wrapper.vm.$nextTick()

    expect(video.currentTime).toBe(84)
    expect(currentTime()).toBe(84)
    expect(play).toHaveBeenCalled()
  })

  it('分享视频时只使用客户端分享能力，不请求不存在的 share 接口', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })

    const { wrapper } = await mountVideoDetail()
    await wrapper.get('[data-testid="video-share"]').trigger('click')

    expect(share).toHaveBeenCalledWith({ title: '当前视频', url: window.location.href })
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith(
      '/api/v1/videos/video-1/share',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('路由 id 快速切换时忽略过期详情响应', async () => {
    const firstVideo = deferred<Response>()
    const firstRecommended = deferred<Response>()
    const secondVideo = deferred<Response>()
    const secondRecommended = deferred<Response>()

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST' && url.endsWith('/view')) return Promise.resolve(makeJsonResponse({}))
      if (url.endsWith('/videos/first')) return firstVideo.promise
      if (url.endsWith('/videos/first/recommended')) return firstRecommended.promise
      if (url.endsWith('/videos/second')) return secondVideo.promise
      if (url.endsWith('/videos/second/recommended')) return secondRecommended.promise
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const { wrapper, router } = await mountVideoDetail('/videos/watch/first')
    await router.push('/videos/watch/second')

    secondVideo.resolve(makeJsonResponse(makeVideo('second', '当前视频')))
    secondRecommended.resolve(makeJsonResponse([makeVideo('second-rec', '当前推荐')]))
    await flushPromises()
    expect(wrapper.text()).toContain('当前视频')
    expect(wrapper.text()).toContain('当前推荐')

    firstVideo.resolve(makeJsonResponse(makeVideo('first', '过期视频')))
    firstRecommended.resolve(makeJsonResponse([makeVideo('first-rec', '过期推荐')]))
    await flushPromises()

    expect(wrapper.text()).toContain('当前视频')
    expect(wrapper.text()).toContain('当前推荐')
    expect(wrapper.text()).not.toContain('过期视频')
    expect(wrapper.text()).not.toContain('过期推荐')
  })

  it('统一评论区的数量变化会同步互动栏计数', async () => {
    const { wrapper } = await mountVideoDetail()
    const comments = wrapper.findComponent(CommentSectionStub)
    comments.vm.$emit('count-change', 3)
    await wrapper.vm.$nextTick()

    expect(mocks.interactions.commentCount.value).toBe(3)
  })
})

describe('VideoDetailView layout', () => {
  it('PVideoPlayerShell component is importable', async () => {
    const { default: PVideoPlayerShell } = await import('@/components/shared/PVideoPlayerShell.vue')
    expect(PVideoPlayerShell).toBeDefined()
  })
})
