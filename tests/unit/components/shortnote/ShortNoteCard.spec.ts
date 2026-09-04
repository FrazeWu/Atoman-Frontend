import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error Vitest resolves Vue SFCs through Vite; this test is outside the Vue TS project.
import ShortNoteCard from '@/components/shortnote/ShortNoteCard.vue'
// @ts-expect-error Vitest resolves the alias through Vite; this test is outside the Vue TS project.
import type { ShortNote } from '@/types'
import { useAuthStore } from '@/stores/auth'

const CommentSideSheetStub = {
  name: 'CommentSideSheet',
  props: ['show', 'target', 'partialAnchor'],
  template: '<aside v-if="show" data-test="short-note-comment-sheet" />',
}

const InteractionActionsStub = {
  name: 'PInteractionActions',
  props: ['liked', 'likeCount', 'disliked', 'dislikeCount'],
  emits: ['like-change', 'dislike-change'],
  template: '<button data-test="short-note-votes" @click="$emit(\'dislike-change\', true)" />',
}

describe('ShortNoteCard', () => {
  const mockNote: ShortNote = {
    id: 'note-test-1',
    user_id: 'user-1',
    content: '这是一条灵感短笺测试内容',
    created_at: new Date().toISOString(),
    media: [],
    likes_count: 5,
    dislikes_count: 2,
    vote_score: 3,
    comments_count: 1,
    liked: false,
  }

  it('首行显示一位小数的点赞率与赞踩总数', () => {
    const wrapper = mount(ShortNoteCard, {
      props: { note: mockNote },
      global: {
        plugins: [createPinia()],
        stubs: { RouterLink: true, CommentSideSheet: CommentSideSheetStub, PImageLightbox: true },
      },
    })

    const headerStats = wrapper.findAll('.sticky-stat').map((stat) => stat.text())
    expect(headerStats).toEqual(['71.4(7)'])
  })

  it('使用赞踩组件，并在点踩后同步服务端投票结果', async () => {
    const pinia = createPinia()
    const authStore = useAuthStore(pinia)
    authStore.token = 'token'
    authStore.user = { uuid: 'reader-1', username: 'reader', role: 'user' } as never
    authStore.isAuthenticated = true
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: { likes_count: 4, dislikes_count: 3, viewer_vote: 'down' },
    }), { status: 200 }))
    const wrapper = mount(ShortNoteCard, {
      props: { note: mockNote },
      global: {
        plugins: [pinia],
        stubs: { RouterLink: true, CommentSideSheet: CommentSideSheetStub, PImageLightbox: true, PInteractionActions: InteractionActionsStub },
      },
    })

    const actions = wrapper.getComponent(InteractionActionsStub)
    expect(actions.props()).toMatchObject({ liked: false, likeCount: 5, disliked: false, dislikeCount: 2 })

    await wrapper.get('[data-test="short-note-votes"]').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/short-notes/note-test-1/vote',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ direction: 'down' }) }),
    )
    expect(actions.props()).toMatchObject({ liked: false, likeCount: 4, disliked: true, dislikeCount: 3 })
    expect(wrapper.get('.sticky-stat').text()).toBe('57.1(7)')
  })

  it('正文区域支持键盘打开讨论', async () => {
    const wrapper = mount(ShortNoteCard, {
      props: { note: mockNote },
      global: {
        plugins: [createPinia()],
        stubs: { RouterLink: true, CommentSideSheet: CommentSideSheetStub, PImageLightbox: true },
      },
    })

    const body = wrapper.get('.sticky-memo-body')
    expect(body.attributes('role')).toBe('button')
    expect(body.attributes('tabindex')).toBe('0')

    await body.trigger('keydown.enter')

    const commentSheet = wrapper.getComponent(CommentSideSheetStub)
    expect(commentSheet.props('show')).toBe(true)
    expect(wrapper.find('[data-test="short-note-comment-sheet"]').exists()).toBe(true)
  })

  it('未读时初始渲染，光标扫过 (mouseenter) 时自动标记为已读', async () => {
    const pinia = createPinia()
    const wrapper = mount(ShortNoteCard, {
      props: {
        note: mockNote,
      },
      global: {
        plugins: [pinia],
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
          CommentSideSheet: CommentSideSheetStub,
          PImageLightbox: true,
        },
      },
    })

    const article = wrapper.get('article.sticky-memo-card')
    // 初始状态下未读
    expect(article.classes()).not.toContain('is-read')

    // 模拟光标扫过 (mouseenter)
    await article.trigger('mouseenter')

    // 扫过后变为已读
    expect(article.classes()).toContain('is-read')
  })
})
