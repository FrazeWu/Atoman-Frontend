import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, expect, it, vi } from 'vitest'
import BookNoteCollectionEditorView from '@/views/books/BookNoteCollectionEditorView.vue'
import BookNoteShareView from '@/views/books/BookNoteShareView.vue'
import * as api from '@/api/bookNoteCollections'
import * as reading from '@/api/bookReading'

vi.mock('@/api/bookNoteCollections', () => ({
  getNoteCollection: vi.fn(), saveNoteCollection: vi.fn(), publishNoteCollection: vi.fn(),
  revokeNoteCollection: vi.fn(), listNoteCollections: vi.fn(), getSharedNoteCollection: vi.fn(),
  getNoteShareImpact: vi.fn(), listPublicNoteShares: vi.fn(),
  previewNoteCollection:vi.fn(),listNoteShareHistory:vi.fn(),getNoteShareHistoryVersion:vi.fn(),
}))
vi.mock('@/api/bookReading', () => ({ listWorkNotes: vi.fn() }))
const old = { id:'draft-1', work_id:'work-1', version:1, published_version:0, visibility:'private' as const,
  title:'研究摘录', description:'只供私人草稿', items:[{kind:'chapter_note' as const,id:'note-1'}], updated_at:'' }
const note = { id:'note-1', type:'chapter_note' as const, title:'第二章笔记',quote:'', note:'自己的思考',created_at:'',updated_at:'' }
const router = () => createRouter({history:createMemoryHistory(),routes:[
 {path:'/books/work/:workId/collections/:collectionId',component:BookNoteCollectionEditorView},
 {path:'/books/note-shares/:shareKey',component:BookNoteShareView},
 {path:'/books/work/:workId/collections',component:{template:'<div>合集</div>'}},
 {path:'/books/work/:workId/notes',component:{template:'<div>我的笔记</div>'}},
 {path:'/books',component:{template:'<div>图书</div>'}},
]})
const confirmStub = {props:['show'],emits:['confirm','cancel'],template:'<div v-if="show" data-confirm-dialog><button type="button" data-confirm @click="$emit(\'confirm\')">确认</button></div>'}
const sheetStub={props:['show'],emits:['close'],template:'<section v-if="show"><slot /></section>'}
beforeEach(()=>{
 vi.resetAllMocks()
 vi.mocked(reading.listWorkNotes).mockResolvedValue({work_id:'work-1',total:1,limit:100,offset:0,items:[note]} as never)
 vi.mocked(api.getNoteCollection).mockResolvedValue({...old} as never)
 vi.mocked(api.saveNoteCollection).mockResolvedValue({...old,version:2} as never)
 vi.mocked(api.publishNoteCollection).mockResolvedValue({...old,version:2,published_version:1,visibility:'link',share_path:'/books/note-shares/long-secret'} as never)
 vi.mocked(api.revokeNoteCollection).mockResolvedValue({...old,version:3,published_version:1,visibility:'private',share_path:''} as never)
 vi.mocked(api.previewNoteCollection).mockResolvedValue({title:'研究摘录',description:'只供私人草稿',items:[{kind:'chapter_note',note:'自己的思考'}],digest:'test-digest'} as never)
 vi.mocked(api.listNoteShareHistory).mockResolvedValue({items:[{version:1,published_at:'2026-11-04T00:00:00Z',title:'研究摘录',description:'冻结版本',note_count:1,active:true}],total:1} as never)
 vi.mocked(api.getNoteShareHistoryVersion).mockResolvedValue({title:'研究摘录',description:'冻结版本',items:[{kind:'chapter_note',note:'已发布的原创心得'}],version:1,published_at:'2026-11-04T00:00:00Z',active:true} as never)
})
it('私人草稿必须确认后发布，链接仅在发布成功后出现，撤销会关闭分享',async()=>{
 const route=router();await route.push('/books/work/work-1/collections/draft-1')
 const wrapper=mount(BookNoteCollectionEditorView,{global:{plugins:[route],stubs:{PPageHeader:true,PConfirm:confirmStub,PSheet:sheetStub}}})
 try{
  await flushPromises()
  expect(wrapper.get('input[aria-label="合集标题"]').element.value).toBe('研究摘录')
  expect(wrapper.text()).toContain('私有')
  await wrapper.get('select[aria-label="选择分享权限"]').setValue('link')
  await wrapper.findAll('button').find(x=>x.text()==='预览并发布')!.trigger('click')
  await flushPromises()
  expect(api.previewNoteCollection).toHaveBeenCalledWith('work-1',expect.objectContaining({title:'研究摘录'}))
  expect(wrapper.text()).toContain('自己的思考')
  expect(api.publishNoteCollection).not.toHaveBeenCalled()
  await wrapper.findAll('button').find(x=>x.text()==='确认按预览发布')!.trigger('click')
  await flushPromises()
  expect(api.publishNoteCollection).toHaveBeenCalledWith('draft-1',1,'link',expect.any(String),'test-digest')
  expect(wrapper.text()).toContain('查看已发布内容')
  await wrapper.get('select[aria-label="选择分享权限"]').setValue('private')
  await wrapper.findAll('button').find(x=>x.text()==='撤销分享')!.trigger('click')
  await wrapper.get('[data-confirm]').trigger('click')
  await flushPromises()
  expect(api.revokeNoteCollection).toHaveBeenCalledWith('draft-1',2)
  expect(wrapper.text()).not.toContain('查看已发布内容')
 }finally{wrapper.unmount()}
})
it('先自动保存私人草稿再发布时不会把用户明确选择的完全公开降级为链接分享',async()=>{
 const route=router();await route.push('/books/work/work-1/collections/draft-1')
 vi.mocked(api.saveNoteCollection).mockResolvedValue({...old,version:2,title:'更新后的公开笔记'} as never)
 vi.mocked(api.publishNoteCollection).mockResolvedValue({...old,version:3,published_version:1,visibility:'public',share_path:'/books/note-shares/stable-key'} as never)
 const wrapper=mount(BookNoteCollectionEditorView,{global:{plugins:[route],stubs:{PPageHeader:true,PConfirm:confirmStub,PSheet:sheetStub}}})
 try{
  await flushPromises()
  await wrapper.get('input[aria-label="合集标题"]').setValue('更新后的公开笔记')
  await wrapper.get('select[aria-label="选择分享权限"]').setValue('public')
  await wrapper.findAll('button').find(x=>x.text()==='预览并发布')!.trigger('click')
  await flushPromises()
  await wrapper.findAll('button').find(x=>x.text()==='确认按预览发布')!.trigger('click')
  await flushPromises()
  expect(api.saveNoteCollection).toHaveBeenCalledWith('draft-1','work-1',1,expect.objectContaining({title:'更新后的公开笔记'}))
  expect(api.publishNoteCollection).toHaveBeenCalledWith('draft-1',2,'public',expect.any(String),'test-digest')
  expect(wrapper.text()).toContain('完全公开')
 }finally{wrapper.unmount()}
})
it('作者能查看不可变历史快照，但历史查看不会再次发布',async()=>{
 vi.mocked(api.getNoteCollection).mockResolvedValue({...old,version:3,published_version:1,visibility:'link',share_path:'/books/note-shares/stable'} as never)
 const route=router();await route.push('/books/work/work-1/collections/draft-1')
 const wrapper=mount(BookNoteCollectionEditorView,{global:{plugins:[route],stubs:{PPageHeader:true,PConfirm:confirmStub,PSheet:sheetStub}}})
 try{
  await flushPromises()
  await wrapper.findAll('button').find(x=>x.text()==='查看历史版本')!.trigger('click')
  await flushPromises()
  expect(api.listNoteShareHistory).toHaveBeenCalledWith('draft-1',0)
  expect(wrapper.text()).toContain('版本 1')
  await wrapper.findAll('button').find(x=>x.text()==='查看冻结内容')!.trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('已发布的原创心得')
  expect(api.publishNoteCollection).not.toHaveBeenCalled()
 }finally{wrapper.unmount()}
})
it('单条分享入口预先选中原始笔记，仍须保存草稿并主动发布',async()=>{
 const route=router();await route.push('/books/work/work-1/collections/new?kind=chapter_note&note_id=note-1')
 const wrapper=mount(BookNoteCollectionEditorView,{global:{plugins:[route],stubs:{PPageHeader:true,PConfirm:confirmStub,PSheet:sheetStub}}})
 try{await flushPromises();expect(wrapper.get('input[type="checkbox"]').element.checked).toBe(true);expect(wrapper.text()).toContain('1/40');expect(api.publishNoteCollection).not.toHaveBeenCalled()}finally{wrapper.unmount()}
})
it('公开页面只使用冻结快照数据，绝不请求私人笔记',async()=>{
 vi.mocked(api.getSharedNoteCollection).mockResolvedValue({title:'公开笔记',description:'已审核说明',version:1,visibility:'link',published_at:'2026-11-04T00:00:00Z',items:[{kind:'highlight',quote:'短摘录',note:'作者批注'}]} as never)
 const route=router();await route.push('/books/note-shares/share-key')
 const wrapper=mount(BookNoteShareView,{global:{plugins:[route]}})
 try{await flushPromises();expect(wrapper.text()).toContain('公开笔记');expect(wrapper.text()).toContain('短摘录');expect(wrapper.text()).toContain('作者批注');expect(api.getSharedNoteCollection).toHaveBeenCalledWith('share-key');expect(reading.listWorkNotes).not.toHaveBeenCalled()}finally{wrapper.unmount()}
})
