import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { listWorkNotes } from '@/api/bookReading'
import { getCatalogWork } from '@/api/bookCatalog'
import BookWorkNotesView from '@/views/books/BookWorkNotesView.vue'

vi.mock('@/api/bookReading', () => ({ listWorkNotes: vi.fn() }))
vi.mock('@/api/bookCatalog', () => ({ getCatalogWork: vi.fn() }))
const mark = {
  id: 'mark-old', type: 'highlight' as const, title: '', quote: '旧 PDF 中的摘录', note: '保留原版定位',
  color: 'yellow', style: 'highlight', anchor: { pdf_page: 7 },
  created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-03T00:00:00Z',
  source: { work_id: 'work-1', edition_id: 'edition-1', asset_id: 'asset-old', revision_id: 'revision-old', file_name: '旧版.pdf', format: 'pdf', can_open: true },
}
const removed = {
  ...mark, id: 'mark-unavailable', note: '', quote: '不可访问但保留的记录',
  source: { ...mark.source, asset_id: 'asset-bad', revision_id: 'revision-bad', file_name: '历史文件.pdf', can_open: false },
}
const anchored = {
  id: 'anchored-note', type: 'chapter_note' as const, title: '第七页的心得', note: '准确跳到源文件', quote: '',
  chapter_anchor: { format: 'pdf' as const, pdf_page: 7, pdf_offset: .42, chapter_title: '第 7 页' },
  created_at: '2026-11-03T00:00:00Z', updated_at: '2026-11-04T00:00:00Z', source: mark.source,
}
const chapter = {
  id: 'note-chapter', type: 'chapter_note' as const, title: '第三章思考', quote: '', note: '独立整理的读书心得',
  created_at: '2026-11-02T00:00:00Z', updated_at: '2026-11-02T00:00:00Z',
}
function createRouterForNotes() {
  return createRouter({ history: createMemoryHistory(), routes: [
    { path: '/books/work/:workId/notes', component: BookWorkNotesView },
    { path: '/books/work/:workId', component: { template: '<div>作品详情</div>' } },
    { path: '/books/read/:workId/:assetId/:revisionId', component: { template: '<div>阅读器</div>' } },
    { path: '/books/notes', component: { template: '<div>独立笔记</div>' } },
  ] })
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getCatalogWork).mockResolvedValue({ id: 'work-1', title: '测试作品' } as never)
  vi.mocked(listWorkNotes).mockResolvedValue({ work_id: 'work-1', total: 4, limit: 30, offset: 0, items: [mark, removed, chapter, anchored] } as never)
})

it('汇总划线和独立笔记，保留旧文件精确跳转；不可用文件不能跳转', async () => {
  const router = createRouterForNotes()
  await router.push('/books/work/work-1/notes')
  const wrapper = mount(BookWorkNotesView, { global: { plugins: [router], stubs: { PPageHeader: true, RouterLink: false } } })
  try {
    await flushPromises()
    expect(getCatalogWork).toHaveBeenCalledWith('work-1')
    expect(wrapper.findAll('.work-notes__entry')).toHaveLength(4)
    expect(wrapper.get('[data-note-id="anchored-note"]').text()).toContain('第 7 页')
    expect(wrapper.get('[data-note-id="anchored-note"]').findComponent({ name: 'RouterLinkStub' }).props('to')).toEqual({ path: '/books/read/work-1/asset-old/revision-old', query: { chapter_note: 'anchored-note' } })
    expect(wrapper.text()).toContain('独立整理的读书心得')
    const previousFile = wrapper.get('[data-note-id="mark-old"]')
    expect(previousFile.text()).toContain('旧版.pdf')
    expect(previousFile.findComponent({ name: 'RouterLinkStub' }).props('to')).toEqual({ path: '/books/read/work-1/asset-old/revision-old', query: { mark: 'mark-old' } })
    const unavailable = wrapper.get('[data-note-id="mark-unavailable"]')
    expect(unavailable.text()).toContain('原文件不可访问')
    expect(unavailable.find('a[href*="/books/read/"]').exists()).toBe(false)
    expect(wrapper.get('[data-note-id="note-chapter"]').find('a[href*="/books/read/"]').exists()).toBe(false)
    expect(listWorkNotes).toHaveBeenCalledWith('work-1', { kind: 'all', revisionId: undefined, limit: 30, offset: 0 }, expect.any(AbortSignal))
  } finally { wrapper.unmount() }
})

it('按具体文件和类型筛选；分页保留记录，不改变原始归属', async () => {
  const router = createRouterForNotes()
  await router.push('/books/work/work-1/notes?revision_id=revision-old')
  const wrapper = mount(BookWorkNotesView, { global: { plugins: [router], stubs: { PPageHeader: true, RouterLink: false } } })
  try {
    await flushPromises()
    expect(listWorkNotes).toHaveBeenCalledWith('work-1', { kind: 'all', revisionId: 'revision-old', limit: 30, offset: 0 }, expect.any(AbortSignal))
    await wrapper.get('#work-notes-filter').setValue('chapter_note')
    await flushPromises()
    expect(listWorkNotes).toHaveBeenLastCalledWith('work-1', { kind: 'chapter_note', revisionId: 'revision-old', limit: 30, offset: 0 }, expect.any(AbortSignal))
    await wrapper.get('.work-notes__clear').trigger('click')
    await flushPromises()
    expect(listWorkNotes).toHaveBeenLastCalledWith('work-1', { kind: 'chapter_note', revisionId: undefined, limit: 30, offset: 0 }, expect.any(AbortSignal))
  } finally { wrapper.unmount() }
})

it('支持关键词搜索并高亮文本', async () => {
  const router = createRouterForNotes()
  await router.push('/books/work/work-1/notes')
  const wrapper = mount(BookWorkNotesView, { global: { plugins: [router], stubs: { PPageHeader: true, RouterLink: false } } })
  try {
    await flushPromises()
    const searchInput = wrapper.get('.work-notes__search-input')
    await searchInput.setValue('心得')
    // Fast-forward debounce 300ms
    await new Promise((r) => setTimeout(r, 350))
    await flushPromises()

    expect(listWorkNotes).toHaveBeenLastCalledWith(
      'work-1',
      { kind: 'all', revisionId: undefined, q: '心得', limit: 30, offset: 0 },
      expect.any(AbortSignal),
    )
    // Check mark tag highlighting
    const marks = wrapper.findAll('mark')
    expect(marks.length).toBeGreaterThan(0)
    expect(marks.some((m) => m.text() === '心得')).toBe(true)
  } finally {
    wrapper.unmount()
  }
})
