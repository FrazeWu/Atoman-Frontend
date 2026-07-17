import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterLink } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import VideoDetailView from '@/views/video/VideoDetailView.vue'
import { useAuthStore } from '@/stores/auth'

const mocks = vi.hoisted(() => ({
  useInteractions: vi.fn(),
  interactions: {
    comments: { value: [] },
    likeCount: { value: 0 },
    commentCount: { value: 0 },
    liked: { value: false },
    loadingComments: { value: false },
    submittingComment: { value: false },
    like: vi.fn(),
    unlike: vi.fn(),
    fetchComments: vi.fn(),
    createComment: vi.fn(),
    deleteComment: vi.fn(),
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

const CommentThreadStub = defineComponent({
  name: 'CommentThread',
  props: ['items', 'canComment', 'canDelete', 'loading', 'submitting', 'submitAction'],
  emits: ['delete'],
  template: '<section data-test="comment-thread" />',
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
        CommentThread: CommentThreadStub,
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
    mocks.interactions.comments.value = []
    mocks.interactions.likeCount.value = 0
    mocks.interactions.commentCount.value = 0
    mocks.interactions.liked.value = false
    mocks.interactions.fetchComments.mockResolvedValue(undefined)
    mocks.interactions.createComment.mockResolvedValue(undefined)
    mocks.interactions.deleteComment.mockResolvedValue(undefined)
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST' && url.endsWith('/view')) return makeJsonResponse({})
      if (url.endsWith('/videos/video-1')) {
        return makeJsonResponse(makeVideo('video-1', '当前视频', {
          liked: true,
          like_count: 6,
          comment_count: 2,
        }))
      }
      if (url.endsWith('/videos/video-1/recommended')) return makeJsonResponse([])
      throw new Error(`unexpected fetch: ${url}`)
    }))
  })

  it('渲染共享互动栏和评论线程，并用响应式 video id 初始化 useInteractions', async () => {
    const { wrapper } = await mountVideoDetail()

    expect(mocks.useInteractions).toHaveBeenCalledWith('videos', 'video', expect.any(Object))
    expect(mocks.useInteractions.mock.calls[0][2].value).toBe('video-1')
    expect(mocks.interactions.liked.value).toBe(true)
    expect(mocks.interactions.likeCount.value).toBe(6)
    expect(mocks.interactions.commentCount.value).toBe(2)
    expect(mocks.interactions.fetchComments).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-test="interaction-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="comment-thread"]').exists()).toBe(true)
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

  it('评论提交时携带从内容提取的视频时间戳', async () => {
    const { wrapper } = await mountVideoDetail()
    const submitAction = wrapper.findComponent(CommentThreadStub).props('submitAction') as (payload: {
      content: string
      parentCommentId?: string
    }) => Promise<void>

    await submitAction({ content: '这里 01:02 很关键', parentCommentId: 'comment-1' })

    expect(mocks.interactions.createComment).toHaveBeenCalledWith('这里 01:02 很关键', 'comment-1', {
      timestamp_sec: 62,
    })
  })
})

describe('VideoDetailView layout', () => {
  it('PVideoPlayerShell component is importable', async () => {
    const { default: PVideoPlayerShell } = await import('@/components/shared/PVideoPlayerShell.vue')
    expect(PVideoPlayerShell).toBeDefined()
  })
})
