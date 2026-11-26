import {beforeEach,describe,it,expect,vi} from 'vitest'
import {mount,flushPromises} from '@vue/test-utils'
import PaperAIActivityPanel from '@/components/papers/PaperAIActivityPanel.vue'
import {listPaperAIActivity,getPaperAIHistoricalChange,type PaperAIActivity,type PaperAIHistoricalChange} from '@/api/papersAI'
import type {PaperFile} from '@/api/papers'
vi.mock('@/api/papersAI',()=>({listPaperAIActivity:vi.fn(),getPaperAIHistoricalChange:vi.fn()}))
const file:PaperFile={id:'file',path:'main.tex',kind:'text',revision:2,content:'Changed',sha256:'',created_at:'',updated_at:''}
const event:PaperAIActivity={id:'applied-id',action:'papers.ai.applied',created_at:'2026-11-26T09:00:00Z',attempt_id:'attempt-id',related_id:'proposal-id',task:'project',project_revision:5,files:[{file_id:file.id,before_revision:1,after_revision:2}]}
describe('AI activity panel',()=>{
 beforeEach(()=>{vi.resetAllMocks();vi.mocked(listPaperAIActivity).mockResolvedValue([event])})
 const create=()=>mount(PaperAIActivityPanel,{props:{projectId:'p',accountId:'owner',files:[file],refresh:0,disabled:false,rollback:vi.fn(async()=>true)}})
 const undo=(w:ReturnType<typeof create>)=>w.findAll('button').find(b=>b.text()==='回滚此修改')!
 it('only rolls back an unchanged applied version and refreshes after confirmation',async()=>{
  const w=create()
  try{
   await flushPromises()
   expect(w.text()).toContain('修改已提交')
   expect(w.text()).toContain('main.tex · v1 → v2')
   expect(undo(w).attributes('disabled')).toBeUndefined()
   vi.mocked(listPaperAIActivity).mockResolvedValue([{...event,id:'rollback-id',action:'papers.ai.rolled_back',related_id:event.id,files:[{file_id:file.id,before_revision:2,after_revision:3}]},event])
   await undo(w).trigger('click')
   await flushPromises()
   expect(w.props('rollback')).toHaveBeenCalledWith(event)
   expect(w.text()).toContain('回滚已提交')
   expect(undo(w).attributes('disabled')).toBeDefined()
  }finally{w.unmount()}
 })
 it('blocks rollback after later edits or when the workspace is disabled',async()=>{
  const w=create()
  try{
   await flushPromises()
   await w.setProps({files:[{...file,revision:3}]})
   expect(undo(w).attributes('disabled')).toBeDefined()
   await w.setProps({files:[file],disabled:true})
   expect(undo(w).attributes('disabled')).toBeDefined()
   expect(w.props('rollback')).not.toHaveBeenCalled()
  }finally{w.unmount()}
 })
 it('loads a verified immutable historical diff on demand and clears it on scope change',async()=>{
  const identity={id:'papers-agent',display_name:'Papers Agent',kind:'ai',permission:'propose_only'} as const
  const change:PaperAIHistoricalChange={event_id:event.id,file_id:file.id,action:event.action,contributor:identity,decision:'owner_approved',path:file.path,before_revision:1,after_revision:2,before:'Before Original After',after:'Before Revised After'}
  vi.mocked(getPaperAIHistoricalChange).mockResolvedValue(change)
  const w=create()
  try{
   await w.setProps({historicalChanges:true})
   await flushPromises()
   expect(getPaperAIHistoricalChange).not.toHaveBeenCalled()
   await w.findAll('button').find(b=>b.text()==='查看修改差异')!.trigger('click')
   await flushPromises()
   expect(getPaperAIHistoricalChange).toHaveBeenCalledWith('p',event.id,file.id,expect.any(AbortSignal))
   expect(w.get('.paper-ai-activity__change del').text()).toBe('Original')
   expect(w.get('.paper-ai-activity__change ins').text()).toBe('Revised')
   await w.setProps({projectId:'other',accountId:'other-owner'})
   await flushPromises()
   expect(w.find('.paper-ai-activity__change').exists()).toBe(false)
  }finally{w.unmount()}
 })
 it('does not show a previous account’s delayed records',async()=>{
  let finish!:(data:PaperAIActivity[])=>void
  vi.mocked(listPaperAIActivity).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockResolvedValueOnce([])
  const w=create()
  try{
   await flushPromises()
   await w.setProps({accountId:'other',projectId:'another-project'})
   await flushPromises()
   finish([event]);await flushPromises()
   expect(w.text()).not.toContain('applied-id')
   expect(w.text()).toContain('暂无操作记录')
  }finally{w.unmount()}
 })
})
