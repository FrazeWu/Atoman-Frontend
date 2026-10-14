import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import BookSelectionToolbar from '@/components/books/BookSelectionToolbar.vue'
import type { BookAnnotation } from '@/api/books'

describe('BookSelectionToolbar', () => {
  it('renders 4 color buttons and default controls', () => {
    const wrapper = mount(BookSelectionToolbar, {
      props: {
        position: { x: 100, y: 200 },
        selectedText: '这是一段测试文本',
      },
    })

    const colorButtons = wrapper.findAll('[data-color]')
    expect(colorButtons).toHaveLength(4)
    expect(wrapper.find('[data-color="yellow"]').exists()).toBe(true)
    expect(wrapper.find('[data-color="green"]').exists()).toBe(true)
    expect(wrapper.find('[data-color="blue"]').exists()).toBe(true)
    expect(wrapper.find('[data-color="pink"]').exists()).toBe(true)

    expect(wrapper.find('[data-testid="style-underline"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="toggle-note"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="copy-quote"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="delete-annotation"]').exists()).toBe(false)
  })

  it('clicking color button emits highlight with selected color and default style', async () => {
    const wrapper = mount(BookSelectionToolbar, {
      props: {
        position: { x: 100, y: 200 },
        selectedText: '测试高亮文本',
      },
    })

    await wrapper.find('[data-color="green"]').trigger('click')

    expect(wrapper.emitted('highlight')).toBeTruthy()
    expect(wrapper.emitted('highlight')?.[0]).toEqual(['green', 'highlight'])
  })

  it('toggling underline mode emits highlight with style="underline"', async () => {
    const wrapper = mount(BookSelectionToolbar, {
      props: {
        position: { x: 100, y: 200 },
        selectedText: '测试下划线文本',
      },
    })

    await wrapper.find('[data-testid="style-underline"]').trigger('click')

    expect(wrapper.emitted('highlight')).toBeTruthy()
    expect(wrapper.emitted('highlight')?.[0]).toEqual(['yellow', 'underline'])
  })

  it('expanding note box, typing note, and clicking save emits save-note', async () => {
    const wrapper = mount(BookSelectionToolbar, {
      props: {
        position: { x: 100, y: 200 },
        selectedText: '写下想法的正文',
      },
    })

    // Note composer initially hidden
    expect(wrapper.find('[data-testid="note-textarea"]').exists()).toBe(false)

    // Click note button to expand composer
    await wrapper.find('[data-testid="toggle-note"]').trigger('click')
    expect(wrapper.find('[data-testid="note-textarea"]').exists()).toBe(true)

    // Type note
    await wrapper.find('[data-testid="note-textarea"]').setValue('这是一条深刻的读者想法')

    // Click save
    await wrapper.find('[data-testid="save-note"]').trigger('click')

    expect(wrapper.emitted('save-note')).toBeTruthy()
    expect(wrapper.emitted('save-note')?.[0]).toEqual(['这是一条深刻的读者想法', 'yellow', 'highlight'])
  })

  it('copy quote button formats quote and emits copy', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    })

    const wrapper = mount(BookSelectionToolbar, {
      props: {
        position: { x: 100, y: 200 },
        selectedText: '天下大势，分久必合，合久必分。',
        bookTitle: '三国演义',
      },
    })

    await wrapper.find('[data-testid="copy-quote"]').trigger('click')

    const expectedQuote = '“天下大势，分久必合，合久必分。” —— 《三国演义》'
    expect(wrapper.emitted('copy')).toBeTruthy()
    expect(wrapper.emitted('copy')?.[0]).toEqual([expectedQuote])
    expect(writeTextMock).toHaveBeenCalledWith(expectedQuote)
  })

  it('delete button appears when existingAnnotation is provided and emits delete', async () => {
    const mockAnnotation: BookAnnotation = {
      id: 'ann-123',
      asset_id: 'asset-456',
      format: 'epub',
      text: '已高亮的文本',
      color: 'blue',
      style: 'highlight',
      note: '原有批注',
      created_at: '2026-10-14T10:00:00Z',
      updated_at: '2026-10-14T10:00:00Z',
    }

    const wrapper = mount(BookSelectionToolbar, {
      props: {
        position: { x: 100, y: 200 },
        selectedText: '已高亮的文本',
        existingAnnotation: mockAnnotation,
      },
    })

    const deleteBtn = wrapper.find('[data-testid="delete-annotation"]')
    expect(deleteBtn.exists()).toBe(true)

    await deleteBtn.trigger('click')

    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')?.[0]).toEqual(['ann-123'])
  })

  it('escape key emits close', async () => {
    const wrapper = mount(BookSelectionToolbar, {
      props: {
        position: { x: 100, y: 200 },
        selectedText: '关闭测试文本',
      },
    })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(wrapper.emitted('close')).toBeTruthy()
    wrapper.unmount()
  })

})
