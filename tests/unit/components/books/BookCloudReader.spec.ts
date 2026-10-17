import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as api from '@/api/bookReading'
import { ApiErrorResponseError } from '@/api/client'
import BookCloudReader from '@/components/books/BookCloudReader.vue'
import BookPublicReaderView from '@/views/books/BookPublicReaderView.vue'
import type { BookReaderSource } from '@/types/bookReaderSource'
import type { ReadingMark } from '@/api/bookReading'
import BookHighlightEditor from '@/components/books/BookHighlightEditor.vue'

const source: BookReaderSource = { title: '历史', backTo: '/books/work/work-1', progressKey: 'revision:user-1:rev-1', asset: { id: 'asset-1', work_id: 'work-1', title: '历史', author: '', format: 'txt', file_name: '历史.txt', content_type: 'text/plain', size: 1000, status: 'published', created_at: '' }, loadContent: async () => new Blob(['正文']) }
const mark: ReadingMark = { id: 'mark-1', revision_id: 'rev-1', version: 2, kind: 'bookmark', anchor: { txt_offset_start: 120 }, label: '书签一', quote: '', note: '', color: '', style: '', created_at: '2026-10-17' }
const bookmark = { id: 'client-mark', reading_percent: .3, txt_offset: 300, label: '30%', created_at: '' }
let wrapper: VueWrapper | undefined
beforeEach(() => {
  localStorage.clear()
  vi.spyOn(api, 'createReadingSession').mockResolvedValue({ session: { id: 'session-1', last_sequence: 0, heartbeat_sequence: 0 }, state: { revision_id: 'rev-1', current_percent: .5, txt_offset: 500, pdf_page: 0, epub_cfi: '', furthest_percent: .8, version: 4 } })
  vi.spyOn(api, 'listReadingMarks').mockResolvedValue({ items: [mark], deleted: [] })
  vi.spyOn(api, 'saveReadingMark').mockResolvedValue({ ...mark, id: bookmark.id, version: 1, anchor: { txt_offset_start: 300 } })
  vi.spyOn(api, 'deleteReadingMark').mockResolvedValue({})
  vi.spyOn(api, 'sendReadingHeartbeat').mockResolvedValue({})
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.restoreAllMocks() })
async function setup() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] })
  await router.push('/')
  wrapper = mount(BookCloudReader, { props: { source, owner: 'user-1', revisionId: 'rev-1' }, global: { plugins: [router], stubs: { BookPublicReaderView: { props: ['source'], template: '<div data-reader />' } } } })
  await flushPromises()
  return wrapper
}
function readerSource() { return wrapper!.findComponent(BookPublicReaderView).props('source') as BookReaderSource }

describe('云端阅读入口', () => {
  it('云端位置与书签加载后交给格式渲染器；不复制本机旧书签', async () => {
    await setup()
    expect(readerSource().initialPosition).toMatchObject({ current_percent: .5, txt_offset: 500 })
    expect(readerSource().bookmarks).toMatchObject([{ id: mark.id, txt_offset: 120 }])
    expect(wrapper!.text()).toContain('已同步到云端')
  })
  it('书签只在服务端确认后加入，并提交修订锚点及 base_version=0', async () => {
    await setup()
    await readerSource().addBookmark!(bookmark)
    expect(api.saveReadingMark).toHaveBeenCalledWith('rev-1', bookmark.id, expect.objectContaining({ base_version: 0, kind: 'bookmark', anchor: { txt_offset_start: 300 } }), expect.any(AbortSignal))
    expect(readerSource().bookmarks).toHaveLength(2)
  })
  it('新增响应丢失后显式重试同一 UUID，不创建重复书签', async () => {
    vi.mocked(api.saveReadingMark).mockRejectedValueOnce(new Error('network'))
    await setup()
    await expect(readerSource().addBookmark!(bookmark)).rejects.toThrow()
    expect(readerSource().bookmarks).toHaveLength(1)
    const retry = wrapper!.findAll('button').find(button => button.text() === '重试标记操作')!
    await retry.trigger('click')
    await flushPromises()
    expect(vi.mocked(api.saveReadingMark).mock.calls[0]!.slice(0, 3)).toEqual(vi.mocked(api.saveReadingMark).mock.calls[1]!.slice(0, 3))
    expect(readerSource().bookmarks).toHaveLength(2)
  })
  it('删除附带当前版本；服务端失败时不提前移除', async () => {
    vi.mocked(api.deleteReadingMark).mockRejectedValueOnce(new Error('offline'))
    await setup()
    await expect(readerSource().removeBookmark!(mark.id)).rejects.toThrow()
    expect(readerSource().bookmarks).toHaveLength(1)
    expect(api.deleteReadingMark).toHaveBeenCalledWith('rev-1', mark.id, 2, expect.any(AbortSignal))
  })
  it('跨设备删除冲突不复活旧书签；重新载入采用完整云端快照', async () => {
    vi.mocked(api.deleteReadingMark).mockRejectedValueOnce(new ApiErrorResponseError(409, 'books.reading_mark_conflict', 'deleted'))
    await setup()
    await expect(readerSource().removeBookmark!(mark.id)).rejects.toThrow()
    expect(wrapper!.text()).toContain('不会覆盖')
    expect(wrapper!.text()).not.toContain('重试标记操作')
    vi.mocked(api.listReadingMarks).mockResolvedValue({ items: [], deleted: [{ id: mark.id, version: 3 }] })
    await wrapper!.findAll('button').find(button => button.text() === '重新载入书签与批注')!.trigger('click')
    await flushPromises()
    expect(readerSource().bookmarks).toEqual([])
    expect(api.saveReadingMark).not.toHaveBeenCalled()
  })
  it('初始云端不可用可重试或明确选择仅本机阅读，不显示已同步', async () => {
    vi.mocked(api.createReadingSession).mockRejectedValue(new Error('offline'))
    await setup()
    expect(wrapper!.find('[data-reader]').exists()).toBe(false)
    expect(wrapper!.text()).not.toContain('已同步到云端')
    await wrapper!.findAll('button').find(button => button.text() === '仅本机阅读')!.trigger('click')
    expect(wrapper!.find('[data-reader]').exists()).toBe(true)
    expect(readerSource().onPosition).toBeTypeOf('function')
    expect(wrapper!.text()).toContain('本机模式的书签不会自动上传')
  })
  it('正文加载失败前不会启动阅读时长统计，卸载中止当前账号请求', async () => {
    await setup()
    expect(api.sendReadingHeartbeat).not.toHaveBeenCalled()
    const signal = vi.mocked(api.listReadingMarks).mock.calls[0]![1]!
    wrapper!.unmount()
    wrapper = undefined
    expect(signal.aborted).toBe(true)
  })
  it('划线失败保留输入和 UUID，重试原请求，成功后才更新显示', async () => {
    vi.mocked(api.saveReadingMark).mockRejectedValueOnce(new Error('lost response')).mockImplementationOnce(async (_, id, input) => ({ ...input, id, revision_id: 'rev-1', version: 1, created_at: '' }))
    await setup()
    wrapper!.findComponent(BookPublicReaderView).vm.$emit('annotate', { quote: '相同段落', anchor: { txt_offset_start: 30, txt_offset_end: 34 } })
    await flushPromises()
    const editor = wrapper!.findComponent(BookHighlightEditor)
    await editor.get('textarea').setValue('需要保留的笔记')
    await editor.get('form').trigger('submit')
    await flushPromises()
    expect(readerSource().annotations).toEqual([])
    expect(editor.get('textarea').element.value).toBe('需要保留的笔记')
    expect(editor.get('textarea').attributes('readonly')).toBeDefined()
    const first = vi.mocked(api.saveReadingMark).mock.calls[0]!
    expect(first[2]).toMatchObject({ base_version: 0, quote: '相同段落', note: '需要保留的笔记', anchor: { txt_offset_start: 30, txt_offset_end: 34 } })
    await editor.get('form').trigger('submit')
    await flushPromises()
    expect(vi.mocked(api.saveReadingMark).mock.calls[1]!.slice(0, 3)).toEqual(first.slice(0, 3))
    expect(readerSource().annotations).toHaveLength(1)
    expect(wrapper!.findComponent(BookHighlightEditor).exists()).toBe(false)
  })
  it('编辑提交原标记版本及不可变锚点，冲突保留输入而不覆盖', async () => {
    const highlight: ReadingMark = { ...mark, kind: 'highlight', quote: '原文', anchor: { txt_offset_start: 5, txt_offset_end: 7 }, note: '旧笔记', color: 'yellow', style: 'highlight' }
    vi.mocked(api.listReadingMarks).mockResolvedValue({ items: [highlight], deleted: [] })
    vi.mocked(api.saveReadingMark).mockRejectedValue(new ApiErrorResponseError(409, 'books.reading_mark_conflict', 'changed'))
    await setup()
    wrapper!.findComponent(BookPublicReaderView).vm.$emit('annotation-edit', highlight)
    await flushPromises()
    const editor = wrapper!.findComponent(BookHighlightEditor)
    await editor.get('textarea').setValue('冲突时不丢失')
    await editor.get('form').trigger('submit')
    await flushPromises()
    expect(api.saveReadingMark).toHaveBeenCalledWith('rev-1', highlight.id, expect.objectContaining({ base_version: 2, anchor: highlight.anchor, quote: '原文', note: '冲突时不丢失' }), expect.any(AbortSignal))
    expect(editor.get('textarea').element.value).toBe('冲突时不丢失')
    expect(editor.props('conflict')).toBe(true)
    expect(editor.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(readerSource().annotations?.[0]?.note).toBe('旧笔记')
  })
  it('删除划线携带版本，响应成功后才从原始标记列表移除', async () => {
    const highlight: ReadingMark = { ...mark, kind: 'highlight', quote: '原文' }
    vi.mocked(api.listReadingMarks).mockResolvedValue({ items: [highlight], deleted: [] })
    await setup()
    wrapper!.findComponent(BookPublicReaderView).vm.$emit('annotation-delete', highlight)
    await flushPromises()
    expect(api.deleteReadingMark).toHaveBeenCalledWith('rev-1', highlight.id, highlight.version, expect.any(AbortSignal))
    expect(readerSource().annotations).toEqual([])
  })
})
