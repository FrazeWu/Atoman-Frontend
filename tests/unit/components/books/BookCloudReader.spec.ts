import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as api from '@/api/bookReading'
import { ApiErrorResponseError } from '@/api/client'
import BookCloudReader from '@/components/books/BookCloudReader.vue'
import BookPublicReaderView from '@/components/books/BookPublicReaderView.vue'
import type { BookReaderSource } from '@/types/bookReaderSource'
import type { ReadingMark } from '@/api/bookReading'
import BookHighlightEditor from '@/components/books/BookHighlightEditor.vue'
import BookChapterNoteEditor from '@/components/books/BookChapterNoteEditor.vue'
import * as privateBook from '@/api/bookPrivate'
import * as noteShares from '@/api/bookNoteCollections'

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
  vi.spyOn(noteShares, 'getNoteShareImpact').mockResolvedValue({ total: 0, items: [] })
  vi.spyOn(api, 'sendReadingHeartbeat').mockResolvedValue({})
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.restoreAllMocks() })
async function setup(location = '/') {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] })
  await router.push(location)
  wrapper = mount(BookCloudReader, { props: { source, owner: 'user-1', revisionId: 'rev-1' }, global: { plugins: [router], stubs: { BookPublicReaderView: { props: ['source'], template: '<div data-reader />' } } } })
  await flushPromises()
  return wrapper
}
function readerSource() { return wrapper!.findComponent(BookPublicReaderView).props('source') as BookReaderSource }

describe('云端阅读入口', () => {
  it('在阅读器里按当前文件位置创建独立章节笔记，提交原始修订锚点', async () => {
    const save = vi.spyOn(privateBook, 'savePrivateNote').mockImplementation(async (id, input) => ({ ...input, id, version: 1, tags: [] }))
    await setup()
    const anchor = { format: 'txt' as const, txt_offset: 567, chapter_title: '正文当前位置' }
    wrapper!.findComponent(BookPublicReaderView).vm.$emit('chapter-note', anchor)
    await flushPromises()
    const editor = wrapper!.findComponent(BookChapterNoteEditor)
    expect(editor.exists()).toBe(true)
    await editor.get('input').setValue('本章心得')
    await editor.get('textarea').setValue('独立笔记正文')
    await editor.get('form').trigger('submit')
    await flushPromises()
    expect(save).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ base_version: 0, work_id: 'work-1', source_revision_id: 'rev-1', chapter_anchor: anchor, title: '本章心得', body: '独立笔记正文' }))
    expect(wrapper!.findComponent(BookChapterNoteEditor).exists()).toBe(false)
  })
  it('章节笔记网络失败后保留原 UUID 与输入，重试不产生重复笔记', async () => {
    const save = vi.spyOn(privateBook, 'savePrivateNote').mockRejectedValueOnce(new Error('network')).mockImplementationOnce(async (id, input) => ({ ...input, id, version: 1, tags: [] }))
    await setup()
    wrapper!.findComponent(BookPublicReaderView).vm.$emit('chapter-note', { format: 'pdf', pdf_page: 11, pdf_offset: .42, chapter_title: '第 11 页' })
    await flushPromises()
    const editor = wrapper!.findComponent(BookChapterNoteEditor)
    await editor.get('textarea').setValue('保存失败不能丢')
    await editor.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper!.text()).toContain('重试保存章节笔记')
    expect(editor.get('textarea').element.value).toBe('保存失败不能丢')
    await wrapper!.findAll('button').find(item => item.text().includes('重试保存章节笔记'))!.trigger('click')
    await flushPromises()
    expect(save.mock.calls).toHaveLength(2)
    expect(save.mock.calls[1]).toEqual(save.mock.calls[0])
    expect(wrapper!.findComponent(BookChapterNoteEditor).exists()).toBe(false)
  })
  it('章节笔记跨设备版本冲突时不覆盖云端，保留本机编辑内容', async () => {
    const save = vi.spyOn(privateBook, 'savePrivateNote').mockRejectedValue(new ApiErrorResponseError(409, 'books.private_note_conflict', 'changed'))
    await setup()
    wrapper!.findComponent(BookPublicReaderView).vm.$emit('chapter-note', { format: 'txt', txt_offset: 200 })
    await flushPromises()
    const editor = wrapper!.findComponent(BookChapterNoteEditor)
    await editor.get('textarea').setValue('保留的本地思考')
    await editor.get('form').trigger('submit')
    await flushPromises()
    expect(editor.get('textarea').element.value).toBe('保留的本地思考')
    expect(editor.props('conflict')).toBe(true)
    expect(wrapper!.text()).not.toContain('重试保存章节笔记')
    expect(save).toHaveBeenCalledTimes(1)
    editor.vm.$emit('close')
    await flushPromises()
    wrapper!.findComponent(BookPublicReaderView).vm.$emit('chapter-note', { format: 'txt', txt_offset: 300 })
    await flushPromises()
    expect(wrapper!.findComponent(BookChapterNoteEditor).exists()).toBe(true)
  })
  it('打开作品级章节笔记深链，准确恢复当前文件文本偏移', async () => {
    const note = { id: 'note-1', work_id: 'work-1', source_revision_id: 'rev-1', chapter_anchor: { format: 'txt' as const, txt_offset: 905, chapter_title: '目标位置' }, version: 1, title: '目标笔记', body: '内容', tags: [] }
    const get = vi.spyOn(privateBook, 'getPrivateNote').mockResolvedValue(note)
    await setup('/?chapter_note=note-1')
    expect(get).toHaveBeenCalledWith('note-1')
    expect(readerSource().initialPosition).toMatchObject({ txt_offset: 905, advance_furthest: false })
  })
  it('本文件已保存的独立笔记可在阅读器内重新编辑', async () => {
    const item = { id: 'note-1', type: 'chapter_note' as const, title: '旧标题', note: '旧内容', quote: '', created_at: '', updated_at: '', source: { work_id: 'work-1', revision_id: 'rev-1', asset_id: 'asset-1', format: 'txt', file_name: '旧文件', can_open: true } }
    const note = { id: 'note-1', work_id: 'work-1', source_revision_id: 'rev-1', version: 2, title: '旧标题', body: '旧内容', tags: [], chapter_anchor: { format: 'txt' as const, txt_offset: 100 } }
    vi.spyOn(api, 'listWorkNotes').mockResolvedValue({ work_id: 'work-1', total: 1, limit: 50, offset: 0, items: [item] })
    vi.spyOn(privateBook, 'getPrivateNote').mockResolvedValue(note)
    const save = vi.spyOn(privateBook, 'savePrivateNote').mockImplementation(async (id, input) => ({ ...input, id, version: 3, tags: [] }))
    await setup()
    await wrapper!.findAll('button').find(item => item.text().includes('查看本书章节笔记'))!.trigger('click')
    await flushPromises()
    await wrapper!.findAll('button').find(item => item.text() === '编辑')!.trigger('click')
    await flushPromises()
    const editor = wrapper!.findComponent(BookChapterNoteEditor)
    expect(editor.exists()).toBe(true)
    await editor.get('textarea').setValue('新增分析')
    await editor.get('form').trigger('submit')
    await flushPromises()
    expect(save).toHaveBeenCalledWith('note-1', expect.objectContaining({ base_version: 2, source_revision_id: 'rev-1', chapter_anchor: note.chapter_anchor, body: '新增分析' }))
  })

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
  it('划线跨设备冲突后可保留本机编辑内容，基于云端最新版本平滑重试并成功同步', async () => {
    const highlight: ReadingMark = { ...mark, kind: 'highlight', quote: '原文', anchor: { txt_offset_start: 5, txt_offset_end: 7 }, note: '旧笔记', color: 'yellow', style: 'highlight' }
    vi.mocked(api.listReadingMarks).mockResolvedValue({ items: [highlight], deleted: [] })
    vi.mocked(api.saveReadingMark).mockRejectedValueOnce(new ApiErrorResponseError(409, 'books.reading_mark_conflict', 'changed'))
    await setup()
    wrapper!.findComponent(BookPublicReaderView).vm.$emit('annotation-edit', highlight)
    await flushPromises()
    const editor = wrapper!.findComponent(BookHighlightEditor)
    await editor.get('textarea').setValue('本机重要批注')
    await editor.get('form').trigger('submit')
    await flushPromises()
    expect(editor.props('conflict')).toBe(true)
    expect(wrapper!.text()).toContain('保留本机修改并同步')

    const latestCloudHighlight: ReadingMark = { ...highlight, version: 5, note: '其他设备的改动' }
    vi.mocked(api.listReadingMarks).mockResolvedValueOnce({ items: [latestCloudHighlight], deleted: [] })
    vi.mocked(api.saveReadingMark).mockResolvedValueOnce({ ...latestCloudHighlight, version: 6, note: '本机重要批注' })

    await wrapper!.findAll('button').find(b => b.text().includes('保留本机修改并同步'))!.trigger('click')
    await flushPromises()

    expect(api.saveReadingMark).toHaveBeenLastCalledWith(
      'rev-1',
      highlight.id,
      expect.objectContaining({ base_version: 5, quote: '原文', note: '本机重要批注' }),
      expect.any(AbortSignal)
    )
    expect(wrapper!.findComponent(BookHighlightEditor).exists()).toBe(false)
  })
  it('跨设备阅读进度冲突时展示云端与本机的位置对比与进度百分比', async () => {
    const conflictErr = new ApiErrorResponseError(409, 'books.reading_state_conflict', 'changed')
    conflictErr.details = { state: { revision_id: 'rev-1', version: 10, current_percent: .85, txt_offset: 850, pdf_page: 0, epub_cfi: '', furthest_percent: .9 } }
    vi.spyOn(api, 'saveCloudReadingState').mockRejectedValueOnce(conflictErr)

    await setup()
    const source = readerSource()
    source.onPosition?.({ current_percent: .25, txt_offset: 250, epub_cfi: '', pdf_page: 0 })
    await new Promise(r => setTimeout(r, 850))
    await flushPromises()

    expect(wrapper!.text()).toContain('其他设备已更新进度')
    expect(wrapper!.text()).toContain('云端：85%')
    expect(wrapper!.text()).toContain('本机：25%')
    expect(wrapper!.text()).toContain('采用云端位置（85%）')
    expect(wrapper!.text()).toContain('保留本机当前位置（25%）并同步')
  })
  it('公开划线删除前提醒受影响合集；明确勾选才能保留冻结分享',async()=>{
    const highlight: ReadingMark = { ...mark, kind:'highlight', quote:'私人原文' }
    vi.mocked(api.listReadingMarks).mockResolvedValue({items:[highlight],deleted:[]})
    vi.mocked(noteShares.getNoteShareImpact).mockResolvedValue({total:1,items:[{collection_id:'coll-1',title:'已公开读书笔记',visibility:'public',share_path:'/books/note-shares/link'}]})
    await setup()
    wrapper!.findComponent(BookPublicReaderView).vm.$emit('annotation-delete',highlight)
    await flushPromises()
    expect(wrapper!.text()).toContain('已公开读书笔记')
    expect(api.deleteReadingMark).not.toHaveBeenCalled()
    await wrapper!.get('input[aria-label="明确保留已发布划线分享"]').setValue(true)
    await wrapper!.findAll('button').find(x=>x.text()==='删除并保留分享')!.trigger('click')
    await flushPromises()
    expect(api.deleteReadingMark).toHaveBeenCalledWith('rev-1',highlight.id,highlight.version,expect.any(AbortSignal),true)
  })
  it('删除划线携带版本，响应成功后才从原始标记列表移除', async () => {
    const highlight: ReadingMark = { ...mark, kind: 'highlight', quote: '原文' }
    vi.mocked(api.listReadingMarks).mockResolvedValue({ items: [highlight], deleted: [] })
    await setup()
    wrapper!.findComponent(BookPublicReaderView).vm.$emit('annotation-delete', highlight)
    await flushPromises()
    expect(noteShares.getNoteShareImpact).toHaveBeenCalledWith('highlight',highlight.id)
    expect(api.deleteReadingMark).not.toHaveBeenCalled()
    await wrapper!.findAll('button').find(x=>x.text()==='删除并撤销相关分享')!.trigger('click')
    await flushPromises()
    expect(api.deleteReadingMark).toHaveBeenCalledWith('rev-1',highlight.id,highlight.version,expect.any(AbortSignal),false)
    expect(readerSource().annotations).toEqual([])
  })
})
