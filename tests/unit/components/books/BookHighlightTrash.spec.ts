import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import * as api from '@/api/bookMarkTrash'
import BookHighlightTrash from '@/components/books/BookHighlightTrash.vue'
vi.mock('@/api/bookMarkTrash',()=>({listTrashedHighlights:vi.fn(),restoreTrashedHighlight:vi.fn(),eraseTrashedHighlight:vi.fn()}))
const item={id:'mark-1',revision_id:'rev-1',version:2,kind:'highlight',quote:'重要原文',note:'已经删除的批注',color:'blue',style:'highlight',label:'',anchor:{txt_offset_start:1,txt_offset_end:5},work_id:'work-1',asset_id:'asset-1',work_title:'原始作品',restore_until:'2026-12-04T00:00:00Z',created_at:''} as const
const confirmStub={props:['show'],emits:['confirm','cancel'],template:'<div v-if="show" data-erase-sheet><button type="button" data-confirm-erase @click="$emit(\'confirm\')">确认永久销毁</button></div>'}
beforeEach(()=>{
 vi.resetAllMocks()
 vi.mocked(api.listTrashedHighlights).mockResolvedValue({items:[item],total:1} as never)
 vi.mocked(api.restoreTrashedHighlight).mockResolvedValue({} as never)
 vi.mocked(api.eraseTrashedHighlight).mockResolvedValue({} as never)
})
it('已删划线展示原引用、批注和恢复截止时间，恢复时使用版本号',async()=>{
 const wrapper=mount(BookHighlightTrash,{global:{stubs:{PConfirm:confirmStub}}})
 try{await flushPromises();expect(wrapper.text()).toContain('重要原文');expect(wrapper.text()).toContain('已经删除的批注');expect(wrapper.text()).toContain('2026')
  await wrapper.findAll('button').find(x=>x.text()==='恢复划线')!.trigger('click');await flushPromises()
  expect(api.restoreTrashedHighlight).toHaveBeenCalledWith(item)
  expect(wrapper.text()).toContain('不会自动重新发布')
 }finally{wrapper.unmount()}
})
it('永久销毁必须再次确认，普通点击无法直接擦除',async()=>{
 const wrapper=mount(BookHighlightTrash,{global:{stubs:{PConfirm:confirmStub}}})
 try{await flushPromises();await wrapper.findAll('button').find(x=>x.text()==='永久销毁')!.trigger('click');await flushPromises()
 expect(api.eraseTrashedHighlight).not.toHaveBeenCalled();await wrapper.get('[data-confirm-erase]').trigger('click');await flushPromises()
 expect(api.eraseTrashedHighlight).toHaveBeenCalledWith(item)
 }finally{wrapper.unmount()}
})
