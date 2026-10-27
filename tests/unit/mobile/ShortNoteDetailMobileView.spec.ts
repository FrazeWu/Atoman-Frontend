import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ShortNoteDetailMobileView from '@mobile/views/blog/ShortNoteDetailMobileView.vue'

describe('ShortNoteDetailMobileView.vue Keyboard & Input Adaptation', () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/notes/:id', component: ShortNoteDetailMobileView },
      { path: '/notes', component: { template: '<div>Notes</div>' } },
    ],
  })

  const mockNote = {
    id: 'n-detail-1',
    content: '短笺详情测试内容',
    author: { name: '测试用户', avatar: '' },
    created_at: '2026-10-21T10:00:00Z',
    likes_count: 5,
    comments_count: 1,
  }

  it('enforces 16px font-size on reply-input in source style to prevent iOS Safari auto-zoom', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'apps/mobile/views/blog/ShortNoteDetailMobileView.vue'),
      'utf8'
    )
    expect(source).toMatch(/\.reply-input[\s\S]*?font-size:\s*16px/)
  })

  it('elevates detail-reply-bar in source style using --mobile-keyboard-height with smooth transition', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'apps/mobile/views/blog/ShortNoteDetailMobileView.vue'),
      'utf8'
    )
    expect(source).toMatch(/\.detail-reply-bar[\s\S]*?var\(--mobile-keyboard-height/)
    expect(source).toMatch(/\.detail-reply-bar[\s\S]*?transition:\s*bottom/)
  })

  it('renders reply bar and triggers input focus handling without errors', async () => {
    const wrapper = mount(ShortNoteDetailMobileView, {
      global: { plugins: [router] },
      props: { initialNote: mockNote },
    })

    const input = wrapper.find('.reply-input')
    expect(input.exists()).toBe(true)

    await input.trigger('focus')

    const replyBar = wrapper.find('.detail-reply-bar')
    expect(replyBar.exists()).toBe(true)
  })
})
