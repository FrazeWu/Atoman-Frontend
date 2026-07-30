import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, defineComponent, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CommentSection from '@/components/comment/CommentSection.vue'
import { useAuthStore } from '@/stores/auth'

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  loadMore: vi.fn(),
  setSort: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  resetComposer: vi.fn(),
  target: { value: null as { comment_count: number } | null },
  roots: { value: [] as Array<{ id: string, replies: unknown[] }> },
  page: { value: 0 },
  hasMore: { value: false },
}))

const PSegmentedControlStub = defineComponent({
  name: 'PSegmentedControl',
  emits: ['update:model-value'],
  template: '<div />',
})

const CommentComposerStub = defineComponent({
  name: 'CommentComposer',
  emits: ['submit'],
  setup(_, { expose }) {
    expose({ reset: mocks.resetComposer })
    return {}
  },
  template: '<div />',
})

const CommentThreadStub = defineComponent({
  name: 'CommentThread',
  emits: ['delete'],
  template: '<div />',
})

vi.mock('@/composables/useComments', () => ({
  useComments: () => ({
    roots: mocks.roots,
    target: mocks.target,
    sort: ref('oldest'),
    page: mocks.page,
    pageSize: ref(20),
    loading: ref(false),
    error: ref(null),
    hasMore: mocks.hasMore,
    isLikePending: () => computed(() => false),
    replyState: () => ({ expanded: false, page: 0, pageSize: 20, hasMore: false, loading: false }),
    load: mocks.load,
    loadMore: mocks.loadMore,
    setSort: mocks.setSort,
    expandReplies: vi.fn(),
    create: mocks.create,
    edit: vi.fn(),
    remove: mocks.remove,
    toggleLike: vi.fn(),
    report: vi.fn(),
    mark: vi.fn(),
    unmark: vi.fn(),
  }),
}))

function mountCommentSection(target = { kind: 'video' as const, resourceId: 'video-1' }) {
  const pinia = createPinia()
  useAuthStore(pinia).isAuthenticated = true
  return mount(CommentSection, {
    props: { target },
    global: {
      plugins: [pinia],
      stubs: {
        CommentComposer: CommentComposerStub,
        CommentReportDialog: true,
        CommentThread: CommentThreadStub,
        PButton: true,
        PSegmentedControl: PSegmentedControlStub,
      },
    },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.load.mockReset()
  mocks.loadMore.mockReset()
  mocks.setSort.mockReset()
  mocks.create.mockReset()
  mocks.remove.mockReset()
  mocks.resetComposer.mockReset()
  mocks.target.value = null
  mocks.roots.value = []
  mocks.page.value = 0
  mocks.hasMore.value = false
})

describe('CommentSection', () => {
  it('首次挂载不重置草稿，切换目标后重置根评论草稿', async () => {
    const wrapper = mountCommentSection()
    await flushPromises()

    expect(mocks.resetComposer).not.toHaveBeenCalled()

    await wrapper.setProps({ target: { kind: 'video', resourceId: 'video-2' } })
    await flushPromises()

    expect(mocks.resetComposer).toHaveBeenCalledTimes(1)
  })

  it('首次加载成功后同步服务端 target 的评论数', async () => {
    mocks.load.mockImplementation(async () => {
      mocks.target.value = { comment_count: 7 }
      mocks.page.value = 1
    })

    const wrapper = mountCommentSection()
    await flushPromises()

    expect(wrapper.emitted('count-change')).toEqual([[7]])
  })

  it('目标切换时不发送过期请求返回的评论数', async () => {
    let resolveFirstLoad!: () => void
    mocks.load
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        resolveFirstLoad = () => {
          mocks.target.value = { comment_count: 9 }
          mocks.page.value = 1
          resolve()
        }
      }))
      .mockImplementationOnce(async () => {
        mocks.target.value = { comment_count: 5 }
        mocks.page.value = 1
    })

    const wrapper = mountCommentSection()
    await nextTick()
    await Promise.resolve()
    expect(mocks.load).toHaveBeenCalledTimes(1)
    await wrapper.setProps({ target: { kind: 'video', resourceId: 'video-2' } })
    resolveFirstLoad()
    await flushPromises()

    expect(wrapper.emitted('count-change')).toEqual([[5]])
  })

  it('排序成功后同步服务端 target 的评论数', async () => {
    mocks.setSort.mockImplementation(async () => {
      mocks.target.value = { comment_count: 11 }
    })

    const wrapper = mountCommentSection()
    await flushPromises()
    wrapper.findComponent(PSegmentedControlStub).vm.$emit('update:model-value', 'newest')
    await flushPromises()

    expect(wrapper.emitted('count-change')).toEqual([[11]])
  })

  it('加载更多成功后同步服务端 target 的评论数', async () => {
    mocks.hasMore.value = true
    mocks.loadMore.mockImplementation(async () => {
      mocks.target.value = { comment_count: 13 }
    })

    const wrapper = mountCommentSection()
    await flushPromises()
    await wrapper.findAll('p-button-stub').at(-1)!.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('count-change')).toEqual([[13]])
  })

  it('创建请求期间切换目标时不发送新目标的评论数', async () => {
    let resolveCreate!: () => void
    mocks.create.mockImplementation(() => new Promise<void>((resolve) => {
      resolveCreate = resolve
    }))

    const wrapper = mountCommentSection()
    await flushPromises()
    wrapper.findComponent(CommentComposerStub).vm.$emit('submit', { content: '旧目标评论' })
    await nextTick()
    await wrapper.setProps({ target: { kind: 'video', resourceId: 'video-2' } })
    await flushPromises()
    const countEventsBeforeCreate = wrapper.emitted('count-change')?.length ?? 0
    mocks.target.value = { comment_count: 5 }
    resolveCreate()
    await flushPromises()

    expect(wrapper.emitted('count-change')?.length ?? 0).toBe(countEventsBeforeCreate)
  })

  it('创建请求经历 A 到 B 到 A 后，旧 A 成功不会重置编辑器或发送评论数', async () => {
    let resolveCreate!: () => void
    mocks.create.mockImplementation(() => new Promise<void>((resolve) => {
      resolveCreate = resolve
    }))

    const wrapper = mountCommentSection()
    await flushPromises()
    wrapper.findComponent(CommentComposerStub).vm.$emit('submit', { content: '旧 A 评论' })
    await nextTick()
    await wrapper.setProps({ target: { kind: 'video', resourceId: 'video-b' } })
    await wrapper.setProps({ target: { kind: 'video', resourceId: 'video-1' } })
    await flushPromises()
    const countEventsBeforeCreateCompletes = wrapper.emitted('count-change')?.length ?? 0
    const resetsBeforeCreateCompletes = mocks.resetComposer.mock.calls.length

    mocks.target.value = { comment_count: 8 }
    resolveCreate()
    await flushPromises()

    expect(wrapper.emitted('count-change')?.length ?? 0).toBe(countEventsBeforeCreateCompletes)
    expect(mocks.resetComposer).toHaveBeenCalledTimes(resetsBeforeCreateCompletes)
  })

  it('创建请求经历 A 到 B 到 A 后，旧 A 失败不会写入发布错误', async () => {
    let rejectCreate!: (error: Error) => void
    mocks.create.mockImplementation(() => new Promise<void>((_, reject) => {
      rejectCreate = reject
    }))

    const wrapper = mountCommentSection()
    await flushPromises()
    wrapper.findComponent(CommentComposerStub).vm.$emit('submit', { content: '旧 A 评论' })
    await nextTick()
    await wrapper.setProps({ target: { kind: 'video', resourceId: 'video-b' } })
    await wrapper.setProps({ target: { kind: 'video', resourceId: 'video-1' } })
    await flushPromises()

    rejectCreate(new Error('request failed'))
    await flushPromises()

    expect(wrapper.text()).not.toContain('发布失败，请重试')
  })

  it('删除请求期间切换目标时不发送新目标的评论数', async () => {
    let resolveRemove!: () => void
    mocks.roots.value = [{ id: 'comment-1', replies: [] }]
    mocks.remove.mockImplementation(() => new Promise<void>((resolve) => {
      resolveRemove = resolve
    }))

    const wrapper = mountCommentSection()
    await flushPromises()
    wrapper.findComponent(CommentThreadStub).vm.$emit('delete', 'comment-1')
    await nextTick()
    await wrapper.setProps({ target: { kind: 'video', resourceId: 'video-2' } })
    await flushPromises()
    const countEventsBeforeRemove = wrapper.emitted('count-change')?.length ?? 0
    mocks.target.value = { comment_count: 4 }
    resolveRemove()
    await flushPromises()

    expect(wrapper.emitted('count-change')?.length ?? 0).toBe(countEventsBeforeRemove)
  })

  it('创建失败后切换目标时不显示旧目标的错误', async () => {
    let rejectCreate!: (error: Error) => void
    mocks.create.mockImplementation(() => new Promise<void>((_, reject) => {
      rejectCreate = reject
    }))

    const wrapper = mountCommentSection()
    await flushPromises()
    wrapper.findComponent(CommentComposerStub).vm.$emit('submit', { content: '旧目标评论' })
    await nextTick()
    await wrapper.setProps({ target: { kind: 'video', resourceId: 'video-2' } })
    await flushPromises()
    rejectCreate(new Error('request failed'))
    await flushPromises()

    expect(wrapper.text()).not.toContain('发布失败，请重试')
  })

  it('旧目标创建失败后切换目标会清空发布错误', async () => {
    mocks.create.mockRejectedValueOnce(new Error('request failed'))

    const wrapper = mountCommentSection()
    await flushPromises()
    wrapper.findComponent(CommentComposerStub).vm.$emit('submit', { content: '旧目标评论' })
    await flushPromises()

    expect(wrapper.text()).toContain('发布失败，请重试')

    await wrapper.setProps({ target: { kind: 'video', resourceId: 'video-2' } })
    await flushPromises()

    expect(wrapper.text()).not.toContain('发布失败，请重试')
  })
})
