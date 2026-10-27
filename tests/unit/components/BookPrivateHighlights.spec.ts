import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import BookPrivateHighlights from '@/components/books/BookPrivateHighlights.vue'
import * as apiPrivate from '@/api/bookPrivate'
import * as apiReading from '@/api/bookReading'
import { useToast } from '@/composables/useToast'

describe('BookPrivateHighlights', () => {
  const sampleItem = {
    id: 'mark-1',
    revision_id: 'rev-1',
    version: 2,
    created_at: '2026-10-22T08:00:00Z',
    kind: 'highlight' as const,
    anchor: { txt_offset_start: 0, txt_offset_end: 10 },
    label: '',
    quote: '科学研究的核心在于提出可检验的问题。',
    note: '方法论重点',
    color: 'yellow',
    style: 'solid',
    work_id: 'work-1',
    asset_id: 'asset-1',
    work_title: '定量数据分析',
  }

  beforeEach(() => {
    vi.spyOn(apiPrivate, 'privateBookRequest').mockResolvedValue({
      items: [sampleItem],
      total: 1,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function createWrapper() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>home</div>' } },
        { path: '/books/work/:id', component: { template: '<div>work</div>' } },
      ],
    })
    await router.push('/')
    await router.isReady()

    const wrapper = mount(BookPrivateHighlights, {
      global: {
        plugins: [router],
        stubs: {
          BookHighlightEditor: true,
        },
      },
    })
    await flushPromises()
    return wrapper
  }

  it('loads and renders highlights from real backend API', async () => {
    const wrapper = await createWrapper()
    expect(wrapper.text()).toContain('定量数据分析')
    expect(wrapper.text()).toContain('科学研究的核心在于提出可检验的问题。')
    expect(wrapper.text()).toContain('方法论重点')
  })

  it('filters by color when clicking color dot', async () => {
    const wrapper = await createWrapper()
    const greenDot = wrapper.find('.book-private-highlights__color-dot.is-green')
    await greenDot.trigger('click')
    await flushPromises()

    expect(apiPrivate.privateBookRequest).toHaveBeenCalledWith(
      expect.stringContaining('color=green')
    )
  })

  it('filters by keyword search on enter', async () => {
    const wrapper = await createWrapper()
    const input = wrapper.find('input[type="search"]')
    await input.setValue('方法论')
    await input.trigger('keyup.enter')
    await flushPromises()

    expect(apiPrivate.privateBookRequest).toHaveBeenCalledWith(
      expect.stringContaining('q=%E6%96%B9%E6%B3%95%E8%AE%BA')
    )
  })

  it('deletes highlight with CAS version', async () => {
    const deleteSpy = vi.spyOn(apiReading, 'deleteReadingMark').mockResolvedValue({})
    const wrapper = await createWrapper()

    // 触发编辑并调用内部删除
    const editBtn = wrapper.findAll('button').find(b => b.text().includes('编辑批注'))
    await editBtn?.trigger('click')
    expect((wrapper.vm as any).draft).toBeTruthy()

    await (wrapper.vm as any).remove()
    await flushPromises()

    expect(deleteSpy).toHaveBeenCalledWith('rev-1', 'mark-1', 2)
  })

  it('copies highlight quote and displays success toast', async () => {
    const toast = useToast()
    toast.clear()
    const writeTextSpy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextSpy },
    })

    const wrapper = await createWrapper()
    const copyBtn = wrapper.find('.book-private-highlights__copy-btn')
    expect(copyBtn.exists()).toBe(true)
    await copyBtn.trigger('click')
    await flushPromises()

    expect(writeTextSpy).toHaveBeenCalledWith('科学研究的核心在于提出可检验的问题。')
    expect(toast.toasts.value.some((t) => t.message === '文本已复制' && t.type === 'success')).toBe(true)
  })
})
