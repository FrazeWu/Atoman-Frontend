import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BookReaderSidebar from '@/components/books/BookReaderSidebar.vue'
import type { BookAnnotation } from '@/api/books'

describe('BookReaderSidebar - Annotations Tab', () => {
  const mockAnnotations: BookAnnotation[] = [
    {
      id: 'ann-1',
      asset_id: 'asset-1',
      format: 'epub',
      epub_cfi: 'epubcfi(/6/4[chap01]!/4/2/10/1:0)',
      text: '第一句精彩的摘录文字',
      color: 'yellow',
      style: 'highlight',
      note: '这是对第一句的个人感悟想法',
      chapter_title: '第一章 启程',
      created_at: '2026-10-14T10:00:00Z',
      updated_at: '2026-10-14T10:00:00Z',
    },
    {
      id: 'ann-2',
      asset_id: 'asset-1',
      format: 'txt',
      txt_offset_start: 100,
      txt_offset_end: 150,
      text: '第二句下划线标记文本',
      color: 'green',
      style: 'underline',
      created_at: '2026-10-14T11:00:00Z',
      updated_at: '2026-10-14T11:00:00Z',
    },
  ]

  it('renders annotations tab with count in tab bar', () => {
    const wrapper = mount(BookReaderSidebar, {
      props: {
        annotations: mockAnnotations,
      },
    })

    const tabs = wrapper.findAll('.book-reader-sidebar__tab')
    const annotationTab = tabs.find((t) => t.text().includes('批注 (2)'))
    expect(annotationTab).toBeDefined()
    expect(annotationTab?.text()).toContain('批注 (2)')
  })

  it('switches to annotations tab and renders annotation cards with quote and note bubble', async () => {
    const wrapper = mount(BookReaderSidebar, {
      props: {
        annotations: mockAnnotations,
      },
    })

    const tabs = wrapper.findAll('.book-reader-sidebar__tab')
    const annotationTab = tabs.find((t) => t.text().includes('批注'))
    expect(annotationTab).toBeDefined()

    await annotationTab?.trigger('click')

    const pane = wrapper.find('.book-reader-sidebar__pane--annotations')
    expect(pane.exists()).toBe(true)
    expect(pane.isVisible()).toBe(true)

    const cards = wrapper.findAll('.book-annotation-card')
    expect(cards).toHaveLength(2)

    expect(cards[0].text()).toContain('第一句精彩的摘录文字')
    expect(cards[0].text()).toContain('这是对第一句的个人感悟想法')
    expect(cards[0].text()).toContain('第一章 启程')

    // Color stripe indicator
    const indicator = cards[0].find('.book-annotation-card__stripe')
    expect(indicator.exists()).toBe(true)
    expect(indicator.attributes('data-color')).toBe('yellow')

    expect(cards[1].text()).toContain('第二句下划线标记文本')
  })

  it('emits annotation-jump when clicking an annotation card or jump button', async () => {
    const wrapper = mount(BookReaderSidebar, {
      props: {
        annotations: mockAnnotations,
        defaultTab: 'annotations',
      },
    })

    const firstCard = wrapper.find('.book-annotation-card')
    expect(firstCard.exists()).toBe(true)

    // Click card body / jump trigger
    const jumpButton = firstCard.find('[data-testid="annotation-jump"]')
    if (jumpButton.exists()) {
      await jumpButton.trigger('click')
    } else {
      await firstCard.trigger('click')
    }

    expect(wrapper.emitted('annotation-jump')).toBeTruthy()
    expect(wrapper.emitted('annotation-jump')?.[0]).toEqual([mockAnnotations[0]])
  })

  it('emits annotation-delete when clicking delete button', async () => {
    const wrapper = mount(BookReaderSidebar, {
      props: {
        annotations: mockAnnotations,
        defaultTab: 'annotations',
      },
    })

    const deleteButton = wrapper.find('[data-testid="annotation-delete"]')
    expect(deleteButton.exists()).toBe(true)

    await deleteButton.trigger('click')

    expect(wrapper.emitted('annotation-delete')).toBeTruthy()
    expect(wrapper.emitted('annotation-delete')?.[0]).toEqual(['ann-1'])
  })

  it('emits annotation-export when clicking export button', async () => {
    const wrapper = mount(BookReaderSidebar, {
      props: {
        annotations: mockAnnotations,
        defaultTab: 'annotations',
      },
    })

    const exportBtn = wrapper.find('[data-testid="annotation-export"]')
    expect(exportBtn.exists()).toBe(true)

    await exportBtn.trigger('click')

    expect(wrapper.emitted('annotation-export')).toBeTruthy()
  })

  it('renders empty state when annotations is empty', () => {
    const wrapper = mount(BookReaderSidebar, {
      props: {
        annotations: [],
        defaultTab: 'annotations',
      },
    })

    const emptyTip = wrapper.find('.book-reader-sidebar__pane--annotations .book-reader-sidebar__empty-tip')
    expect(emptyTip.exists()).toBe(true)
    expect(emptyTip.text()).toContain('暂无划线与批注')
  })
})
