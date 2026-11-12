import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as api from '@/api/bookPrivate'
import * as shareApi from '@/api/bookNoteCollections'
import * as fileShelf from '@/api/bookFileShelf'
import * as cacheUtil from '@/utils/bookOfflineCache'
import BookPrivateLibraryView from '@/views/books/BookPrivateLibraryView.vue'
import BookPrivateNotesView from '@/views/books/BookPrivateNotesView.vue'
const wrappers: VueWrapper[] = []
const note: api.PrivateNote = { id: 'note-1', work_id: 'work-1', version: 7, title: '读书笔记', body: '私人内容', tags: ['历史'] }
beforeEach(() => { setActivePinia(createPinia()); vi.spyOn(api, 'listPrivateNotes').mockResolvedValue({ items: [note], total: 1 }); vi.spyOn(shareApi, 'getNoteShareImpact').mockResolvedValue({ total: 0, items: [] }) })
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.restoreAllMocks() })
async function setup(component: typeof BookPrivateNotesView | typeof BookPrivateLibraryView) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/books/notes', component }, { path: '/books', component: { template: '<p>发现</p>' } }, { path: '/books/read/:workId/:assetId/:revisionId', component: { template: '<p>阅读器</p>' } }] })
  await router.push('/books/notes'); await router.isReady()
  const wrapper = mount(component, { global: { plugins: [router], stubs: { BookPrivateHighlights: true, PSheet: { props: ['show'], template: '<section v-if="show"><slot /></section>' }, PConfirm: { props: ['show'], template: '<div v-if="show"><button data-confirm @click="$emit(\'confirm\')">确定</button></div>' } } } })
  wrappers.push(wrapper); await flushPromises(); return wrapper
}
it('私人笔记编辑使用原版本，保存失败保持输入与编辑器', async () => {
  const save = vi.spyOn(api, 'savePrivateNote').mockRejectedValue(new Error('conflict'))
  const wrapper = await setup(BookPrivateNotesView)
  await wrapper.findAll('button').find(button => button.text() === '编辑')!.trigger('click')
  await wrapper.get('textarea').setValue('尚未确认的正文')
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(save).toHaveBeenCalledWith('note-1', expect.objectContaining({ base_version: 7, body: '尚未确认的正文', tags: ['历史'] }))
  expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('尚未确认的正文')
  expect(wrapper.text()).toContain('输入仍保留')
})
it('删除需确认且保留当前 CAS 版本', async () => {
  const remove = vi.spyOn(api, 'deletePrivateNote').mockResolvedValue({})
  const wrapper = await setup(BookPrivateNotesView)
  await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
  await flushPromises()
  expect(shareApi.getNoteShareImpact).toHaveBeenCalledWith('chapter_note', note.id)
  expect(remove).not.toHaveBeenCalled()
  await wrapper.findAll('button').find(button => button.text() === '删除并撤销相关分享')!.trigger('click')
  await flushPromises()
  expect(remove).toHaveBeenCalledWith(note, false)
})
it('删除关联分享时明确显示受影响合集，只有勾选才保留公开快照', async () => {
  vi.spyOn(shareApi, 'getNoteShareImpact').mockResolvedValue({ total: 1, items: [{ collection_id: 'coll-1', title: '历史读书合集', visibility: 'link', share_path: '/books/note-shares/key' }] })
  const remove = vi.spyOn(api, 'deletePrivateNote').mockResolvedValue({})
  const wrapper = await setup(BookPrivateNotesView)
  await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('历史读书合集')
  expect(remove).not.toHaveBeenCalled()
  await wrapper.get('input[aria-label="明确保留已发布快照"]').setValue(true)
  await wrapper.findAll('button').find(button => button.text() === '删除并保留分享')!.trigger('click')
  await flushPromises()
  expect(remove).toHaveBeenCalledWith(note, true)
})
it('回收站恢复使用删除后的版本，不把旧副本覆盖回云端', async () => {
  vi.spyOn(api, 'listPrivateNotes').mockResolvedValue({ items: [{ ...note, version: 8, trashed_at: '2026-10-17' }], total: 1 })
  const restore = vi.spyOn(api, 'restorePrivateNote').mockResolvedValue({})
  const wrapper = await setup(BookPrivateNotesView); await wrapper.get('input[type="checkbox"]').setValue(true); await flushPromises()
  await wrapper.findAll('button').find(button => button.text() === '恢复笔记')!.trigger('click'); await flushPromises()
  expect(restore).toHaveBeenCalledWith(expect.objectContaining({ id: 'note-1', version: 8 }))
})
it('回收站里的独立笔记必须二次确认后才能永久销毁',async()=>{
 const stored={...note,version:8,trashed_at:'2026-10-17'}
 vi.spyOn(api,'listPrivateNotes').mockResolvedValue({items:[stored],total:1})
 const erase=vi.spyOn(api,'erasePrivateNote').mockResolvedValue({} as never)
 const wrapper=await setup(BookPrivateNotesView)
 await wrapper.get('input[type="checkbox"]').setValue(true)
 await flushPromises()
 await wrapper.findAll('button').find(x=>x.text()==='彻底销毁')!.trigger('click')
 expect(erase).not.toHaveBeenCalled()
 await wrapper.get('[data-confirm]').trigger('click')
 await flushPromises()
 expect(erase).toHaveBeenCalledWith(expect.objectContaining({id:'note-1',version:8}))
})
it('书架固定绑定具体文件，包含归档与历史书，点击直接续读', async () => {
  const list = vi.spyOn(fileShelf, 'listFileShelf').mockResolvedValue({
    items: [
      { id: 'shelf-a', revision_id: 'revision-old', asset_id: 'asset-a', work_id: 'work-1', edition_id: 'edition-1', title: '图书', format: 'pdf', status: 'reading', archived: true, furthest_percent: 0.7, has_better: true, file_available: true, cover_url: '', created_at: '2026-11-03T00:00:00Z' },
      { id: 'shelf-b', revision_id: 'revision-new', asset_id: 'asset-b', work_id: 'work-1', edition_id: 'edition-1', title: '图书', format: 'epub', status: 'unstarted', archived: false, furthest_percent: 0, has_better: false, file_available: true, cover_url: '', created_at: '2026-11-03T00:00:01Z' },
    ], total: 2,
  })
  const save = vi.spyOn(fileShelf, 'saveFileShelf').mockResolvedValue({} as never)
  const wrapper = await setup(BookPrivateLibraryView)
  expect(list).toHaveBeenCalledWith({ sort: 'activity', status: '' })
  expect(wrapper.findAll('.file-library__card')).toHaveLength(2)
  expect(wrapper.text()).toContain('有更优版本')
  expect(wrapper.text()).toContain('已归档')
  expect(wrapper.text()).toContain('最远阅读 70%')
  await wrapper.get('.file-library__card .file-library__cover').trigger('click')
  await flushPromises()
  expect(wrapper.vm.$router.currentRoute.value.path).toBe('/books/read/work-1/asset-a/revision-old')
  await wrapper.get('.file-library__card summary').trigger('click')
  await wrapper.findAll('.file-library__card details button').find(item => item.text() === '取消归档')!.trigger('click')
  await flushPromises()
  expect(save).toHaveBeenCalledWith('revision-old', { archived: false })
})

it('书架支持分段控制器切换阅读状态与本地离线筛选', async () => {
  const list = vi.spyOn(fileShelf, 'listFileShelf').mockResolvedValue({
    items: [
      { id: 'shelf-1', revision_id: 'rev-1', asset_id: 'asset-1', work_id: 'w-1', title: '在读图书', format: 'epub', status: 'reading', archived: false, furthest_percent: 0.3, has_better: false, file_available: true, cover_url: '', created_at: '2026-11-03T00:00:00Z' },
      { id: 'shelf-2', revision_id: 'rev-2', asset_id: 'asset-2', work_id: 'w-2', title: '想读书目', format: 'txt', status: 'unstarted', archived: false, furthest_percent: 0, has_better: false, file_available: true, cover_url: '', created_at: '2026-11-03T00:00:01Z' },
    ],
    total: 2,
  })
  vi.spyOn(cacheUtil, 'initBookOfflineCache').mockResolvedValue(new Set(['rev-1']))
  vi.spyOn(cacheUtil, 'getBookOfflineStorageInfo').mockResolvedValue({ count: 1, totalBytes: 1048576, revisionIds: ['rev-1'] })

  const wrapper = await setup(BookPrivateLibraryView)
  expect(list).toHaveBeenCalledWith({ sort: 'activity', status: '' })

  // 点击在读分段
  const readingSegment = wrapper.findAll('.p-segmented-control-item').find(el => el.text().includes('在读'))
  expect(readingSegment).toBeDefined()
  await readingSegment!.trigger('click')
  await flushPromises()
  expect(list).toHaveBeenCalledWith({ sort: 'activity', status: 'reading' })

  // 点击本地离线分段
  const offlineSegment = wrapper.findAll('.p-segmented-control-item').find(el => el.text().includes('本地离线'))
  expect(offlineSegment).toBeDefined()
  await offlineSegment!.trigger('click')
  await flushPromises()
  // 离线筛选仅显示 rev-1
  const visibleCards = wrapper.findAll('.file-library__card')
  expect(visibleCards).toHaveLength(1)
  expect(visibleCards[0].text()).toContain('在读图书')
})

it('书架提供本地离线存储统计与清空操作', async () => {
  vi.spyOn(fileShelf, 'listFileShelf').mockResolvedValue({
    items: [
      { id: 'shelf-1', revision_id: 'rev-1', asset_id: 'asset-1', work_id: 'w-1', title: '缓存图书', format: 'epub', status: 'reading', archived: false, furthest_percent: 0.5, has_better: false, file_available: true, cover_url: '', created_at: '2026-11-03T00:00:00Z' },
    ],
    total: 1,
  })
  vi.spyOn(cacheUtil, 'initBookOfflineCache').mockResolvedValue(new Set(['rev-1']))
  vi.spyOn(cacheUtil, 'getBookOfflineStorageInfo').mockResolvedValue({ count: 1, totalBytes: 5242880, revisionIds: ['rev-1'] })
  const clearSpy = vi.spyOn(cacheUtil, 'clearAllBookOfflineCache').mockResolvedValue(true)

  const wrapper = await setup(BookPrivateLibraryView)
  expect(wrapper.text()).toContain('1 本已缓存')
  expect(wrapper.text()).toContain('5.0 MB')

  // 触发清理按钮
  const purgeBtn = wrapper.find('.file-library__storage-purge-btn')
  expect(purgeBtn.exists()).toBe(true)
  await purgeBtn.trigger('click')
  await flushPromises()

  // 确认清理弹窗
  await wrapper.get('[data-confirm]').trigger('click')
  await flushPromises()
  expect(clearSpy).toHaveBeenCalled()
})
