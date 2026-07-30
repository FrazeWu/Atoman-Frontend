import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { CommentRootList } from '@/api/comments'
import CommentSection from '@/components/comment/CommentSection.vue'
import { useAuthStore } from '@/stores/auth'

const api = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return { ...actual, apiGet: api.get }
})

const PSegmentedControlStub = defineComponent({
  name: 'PSegmentedControl',
  emits: ['update:modelValue'],
  template: '<button class="set-newest" @click="$emit(\'update:modelValue\', \'newest\')" />',
})

const PButtonStub = defineComponent({
  name: 'PButton',
  emits: ['click'],
  template: '<button class="load-more" @click="$emit(\'click\')" />',
})

const CommentComposerStub = defineComponent({
  name: 'CommentComposer',
  setup(_, { expose }) {
    expose({ reset: vi.fn() })
    return {}
  },
  template: '<div />',
})

const CommentThreadStub = defineComponent({
  name: 'CommentThread',
  props: ['root'],
  template: '<article class="comment-thread">{{ root.content }}</article>',
})

function response(resourceId: string, commentCount: number, rootId: string): CommentRootList {
  return {
    items: [{
      id: rootId,
      author_id: 'author-1',
      author: { id: 'author-1', username: 'author', display_name: 'Author', avatar_url: '' },
      root_id: null,
      reply_to_id: null,
      reply_to_author: null,
      floor_number: 1,
      content: rootId,
      rendered_html: rootId,
      status: 'visible',
      edited_at: null,
      like_count: 0,
      reply_count: 0,
      hot_score: 0,
      created_at: '2026-01-01T00:00:00Z',
      marked: false,
      liked: false,
      mentions: [],
      references: [],
      attachments: [],
      time_anchors: [],
      replies: [],
    }],
    page: 1,
    per_page: 20,
    total_roots: 1,
    total_comments: commentCount,
    total_replies: 0,
    target: {
      kind: 'video',
      resource_id: resourceId,
      mark_label: 'Mark',
      can_mark: false,
      marked_comment_id: null,
      comment_count: commentCount,
      root_count: 1,
    },
  }
}

function mountCommentSection() {
  const pinia = createPinia()
  useAuthStore(pinia).isAuthenticated = true
  return mount(CommentSection, {
    props: { target: { kind: 'video' as const, resourceId: 'video-a' } },
    global: {
      plugins: [pinia],
      stubs: {
        CommentComposer: CommentComposerStub,
        CommentReportDialog: true,
        CommentThread: CommentThreadStub,
        PButton: PButtonStub,
        PSegmentedControl: PSegmentedControlStub,
      },
    },
  })
}

describe('CommentSection real useComments integration', () => {
  it('切换目标后只发送 B 的评论数，且不保留延迟 A 的评论', async () => {
    let resolveA!: (value: CommentRootList) => void
    api.get
      .mockImplementationOnce(() => new Promise<CommentRootList>((resolve) => {
        resolveA = resolve
      }))
      .mockResolvedValueOnce(response('video-b', 5, 'root-b'))

    const wrapper = mountCommentSection()
    await nextTick()
    expect(api.get).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ target: { kind: 'video', resourceId: 'video-b' } })
    resolveA(response('video-a', 9, 'root-a'))
    await flushPromises()

    expect(api.get).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('count-change')).toEqual([[5]])
    expect(wrapper.text()).not.toContain('root-a')
    expect(wrapper.text()).toContain('root-b')
  })

  it.each([
    ['排序', '.set-newest', response('video-a', 3, 'root-a')],
    ['加载更多', '.load-more', { ...response('video-a', 3, 'root-a'), total_roots: 21 }],
  ])('切换到 B 后延迟 A 的%s完成不会再次发送评论数', async (_action, selector, initialResponse) => {
    let resolveOldRequest!: (value: CommentRootList) => void
    api.get
      .mockResolvedValueOnce(initialResponse)
      .mockImplementationOnce(() => new Promise<CommentRootList>((resolve) => {
        resolveOldRequest = resolve
      }))
      .mockResolvedValueOnce(response('video-b', 5, 'root-b'))

    const wrapper = mountCommentSection()
    await flushPromises()

    await wrapper.find(selector).trigger('click')
    expect(api.get).toHaveBeenCalledTimes(2)

    await wrapper.setProps({ target: { kind: 'video', resourceId: 'video-b' } })
    await flushPromises()
    const eventsBeforeOldRequestCompletes = wrapper.emitted('count-change')?.length ?? 0

    resolveOldRequest(response('video-a', 3, 'root-a'))
    await flushPromises()

    expect(wrapper.emitted('count-change')).toHaveLength(eventsBeforeOldRequestCompletes)
  })

  it('排序请求经历 A 到 B 到 A 后，旧 A 完成不会重复发送评论数', async () => {
    let resolveOldSort!: (value: CommentRootList) => void
    api.get
      .mockResolvedValueOnce(response('video-a', 3, 'root-a-initial'))
      .mockImplementationOnce(() => new Promise<CommentRootList>((resolve) => {
        resolveOldSort = resolve
      }))
      .mockResolvedValueOnce(response('video-b', 5, 'root-b'))
      .mockResolvedValueOnce(response('video-a', 7, 'root-a-current'))

    const wrapper = mountCommentSection()
    await flushPromises()

    await wrapper.find('.set-newest').trigger('click')
    await wrapper.setProps({ target: { kind: 'video', resourceId: 'video-b' } })
    await flushPromises()
    await wrapper.setProps({ target: { kind: 'video', resourceId: 'video-a' } })
    await flushPromises()
    const countEventsBeforeOldSortCompletes = wrapper.emitted('count-change')?.length ?? 0

    resolveOldSort(response('video-a', 3, 'root-a-old-sort'))
    await flushPromises()

    expect(wrapper.emitted('count-change')).toHaveLength(countEventsBeforeOldSortCompletes)
  })
})
