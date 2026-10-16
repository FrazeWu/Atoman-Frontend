import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BookQuoteActionModal from '@/components/books/BookQuoteActionModal.vue'

describe('BookQuoteActionModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders target options for blog post and short note when no existing draft', () => {
    const wrapper = mount(BookQuoteActionModal, {
      props: {
        open: true,
        item: { id: 'a1', text: '引用文本', note: '想法' } as any,
        bookTitle: '百年孤独',
        bookAuthor: '加西亚·马尔克斯',
        hasExistingDraft: false,
      },
      global: {
        stubs: { Teleport: true },
      },
    })

    expect(wrapper.text()).toContain('转为长文博文')
    expect(wrapper.text()).toContain('转为随手短笺')
  })

  it('emits select with target short_note when clicking short note option', async () => {
    const wrapper = mount(BookQuoteActionModal, {
      props: {
        open: true,
        item: { id: 'a1', text: '引用文本' } as any,
        bookTitle: '百年孤独',
        hasExistingDraft: false,
      },
      global: {
        stubs: { Teleport: true },
      },
    })

    const shortNoteBtn = wrapper.find('[data-testid="quote-target-short-note"]')
    expect(shortNoteBtn.exists()).toBe(true)
    await shortNoteBtn.trigger('click')

    expect(wrapper.emitted('select')?.[0]).toEqual([{ target: 'short_note', mode: 'replace' }])
  })

  it('renders conflict resolution options when hasExistingDraft is true', () => {
    const wrapper = mount(BookQuoteActionModal, {
      props: {
        open: true,
        item: { id: 'a1', text: '引用文本' } as any,
        bookTitle: '百年孤独',
        hasExistingDraft: true,
      },
      global: {
        stubs: { Teleport: true },
      },
    })

    expect(wrapper.text()).toContain('检测到已有博文草稿')
    expect(wrapper.find('[data-testid="quote-target-blog-append"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="quote-target-blog-replace"]').exists()).toBe(true)
  })

  it('emits select with mode append when choosing append to existing draft', async () => {
    const wrapper = mount(BookQuoteActionModal, {
      props: {
        open: true,
        item: { id: 'a1', text: '引用文本' } as any,
        bookTitle: '百年孤独',
        hasExistingDraft: true,
      },
      global: {
        stubs: { Teleport: true },
      },
    })

    const appendBtn = wrapper.find('[data-testid="quote-target-blog-append"]')
    await appendBtn.trigger('click')

    expect(wrapper.emitted('select')?.[0]).toEqual([{ target: 'blog_post', mode: 'append' }])
  })
})
