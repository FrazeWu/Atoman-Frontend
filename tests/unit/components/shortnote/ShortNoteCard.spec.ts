import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'
// @ts-expect-error Vitest resolves Vue SFCs through Vite; this test is outside the Vue TS project.
import ShortNoteCard from '@/components/shortnote/ShortNoteCard.vue'
// @ts-expect-error Vitest resolves the alias through Vite; this test is outside the Vue TS project.
import type { ShortNote } from '@/types'

describe('ShortNoteCard', () => {
  const mockNote: ShortNote = {
    id: 'note-test-1',
    user_id: 'user-1',
    content: '这是一条灵感短笺测试内容',
    created_at: new Date().toISOString(),
    media: [],
    likes_count: 3,
    dislikes_count: 5,
    vote_score: -2,
    comments_count: 1,
    liked: false,
  }

  it('首行显示点赞数与赞踩总数的比例', () => {
    const wrapper = mount(ShortNoteCard, {
      props: { note: mockNote },
      global: {
        plugins: [createPinia()],
        stubs: { RouterLink: true, CommentSection: true, PImageLightbox: true },
      },
    })

    const headerStats = wrapper.findAll('.sticky-stat').map((stat) => stat.text())
    expect(headerStats).toEqual(['3/8'])
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
          CommentSection: true,
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
