import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as api from '@/api/bookPrivate'
import BookPrivateLibraryView from '@/views/books/BookPrivateLibraryView.vue'
import BookPrivateNotesView from '@/views/books/BookPrivateNotesView.vue'
const wrappers: VueWrapper[] = []
const note: api.PrivateNote = { id: 'note-1', work_id: 'work-1', version: 7, title: '读书笔记', body: '私人内容', tags: ['历史'] }
beforeEach(() => { setActivePinia(createPinia()); vi.spyOn(api, 'listPrivateNotes').mockResolvedValue({ items: [note], total: 1 }) })
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.restoreAllMocks() })
async function setup(component: typeof BookPrivateNotesView | typeof BookPrivateLibraryView) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/books/notes', component }, { path: '/books', component: { template: '<p>发现</p>' } }] })
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
  expect(remove).not.toHaveBeenCalled(); await wrapper.get('[data-confirm]').trigger('click'); await flushPromises()
  expect(remove).toHaveBeenCalledWith(note)
})
it('回收站恢复使用删除后的版本，不把旧副本覆盖回云端', async () => {
  vi.spyOn(api, 'listPrivateNotes').mockResolvedValue({ items: [{ ...note, version: 8, trashed_at: '2026-10-17' }], total: 1 })
  const restore = vi.spyOn(api, 'restorePrivateNote').mockResolvedValue({})
  const wrapper = await setup(BookPrivateNotesView); await wrapper.get('input[type="checkbox"]').setValue(true); await flushPromises()
  await wrapper.findAll('button').find(button => button.text() === '恢复笔记')!.trigger('click'); await flushPromises()
  expect(restore).toHaveBeenCalledWith(expect.objectContaining({ id: 'note-1', version: 8 }))
})
it('书架只有作品状态和私人标签，不再混入本地导入记录', async () => {
  vi.spyOn(api, 'listLibrary').mockResolvedValue({ items: [{ id: 'entry', work_id: 'work', work_title: '图书', status: 'reading', tags: ['历史'], version: 3 }], total: 1 })
  vi.spyOn(api, 'readingStatistics').mockResolvedValue({ total_seconds: 120, days: [], works: [], timezone: 'UTC', from: '', to: '' })
  const save = vi.spyOn(api, 'saveLibrary').mockResolvedValue({ id: 'entry', version: 4 } as never)
  const wrapper = await setup(BookPrivateLibraryView)
  expect(wrapper.text()).not.toContain('本地导入'); expect(wrapper.text()).toContain('有效阅读 2 分钟')
  await wrapper.findAll('select')[1].setValue('read'); await flushPromises()
  expect(save).toHaveBeenCalledWith('work', 'read', ['历史'], expect.objectContaining({ id: 'entry' }))
})
