import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import {mount,flushPromises} from '@vue/test-utils'
import PaperAITools from '@/components/papers/PaperAITools.vue'
import {getPaperAICapability,requestPaperAISuggestion} from '@/api/papersAI'
import {getPaperFile,type PaperFile} from '@/api/papers'

vi.mock('@/api/papersAI',()=>({getPaperAICapability:vi.fn(),requestPaperAISuggestion:vi.fn()}))
vi.mock('@/api/papers',()=>({getPaperFile:vi.fn()}))
const file:PaperFile={id:'main',path:'main.tex',kind:'text',content:'Before Original After',revision:1,sha256:'',created_at:'',updated_at:''}
const extra:PaperFile={...file,id:'refs',path:'refs.bib',content:'Approved references'}
const cap={enabled:true,base_urls:['https://api.openai.com/v1'],max_source_bytes:48*1024,max_context_bytes:96*1024,max_extra_files:4}
const key='synthetic-test-key'
describe('Papers AI review workflow',()=>{
 beforeEach(()=>{
  vi.resetAllMocks()
  vi.mocked(getPaperAICapability).mockResolvedValue(cap)
  vi.mocked(requestPaperAISuggestion).mockResolvedValue({text:'Revised',model:'test-model',input_tokens:10,output_tokens:5})
  vi.mocked(getPaperFile).mockResolvedValue(extra)
 })
 afterEach(()=>vi.clearAllMocks())
 const create=()=>mount(PaperAITools,{props:{projectId:'project',accountId:'owner',file,source:file.content,files:[file,extra],disabled:false,captureSelection:()=>({from:7,to:15,baseline:file.content}),applyEdit:vi.fn(()=>true)}})
 const button=(w:ReturnType<typeof create>,name:string)=>w.findAll('button').find(b=>b.text()===name)!
 async function configure(w:ReturnType<typeof create>){
  await flushPromises()
  await w.get('[aria-label="AI API Key"]').setValue(key)
  await w.get('[aria-label="AI 模型"]').setValue('test-model')
  await button(w,'学术润色').trigger('click')
 }
 it('requires explicit consent, includes only approved context, and accepts only on review',async()=>{
  const w=create()
  try{
   await configure(w)
   expect(w.text()).toContain('Original')
   expect(button(w,'生成建议').attributes('disabled')).toBeDefined()
   await w.get('.paper-ai__context input[type=checkbox]').setValue(true)
   await flushPromises()
   expect(w.text()).toContain('Approved references')
   await w.get('.paper-ai__consent input').setValue(true)
   await button(w,'生成建议').trigger('click')
   await flushPromises()
   expect(requestPaperAISuggestion).toHaveBeenCalledTimes(1)
   expect(vi.mocked(requestPaperAISuggestion).mock.calls[0]?.[1]).toMatchObject({file_id:'main',base_revision:1,source:'Original',context:[{file_id:'refs',revision:1}],api_key:key,consent:true})
   expect(w.props('applyEdit')).not.toHaveBeenCalled()
   expect(w.text()).toContain('建议替换为')
   expect(w.text()).toContain('Revised')
   await button(w,'接受修改').trigger('click')
   expect(w.props('applyEdit')).toHaveBeenCalledWith({fileId:'main',revision:1,baseline:file.content,from:7,to:15,replacement:'Revised'})
   expect(w.text()).toContain('已接受修改')
  }finally{w.unmount()}
 })
 it('does not apply a suggestion after the source has changed',async()=>{
  const w=create()
  try{
   await configure(w)
   await w.get('.paper-ai__consent input').setValue(true)
   await button(w,'生成建议').trigger('click')
   await flushPromises()
   await w.setProps({source:file.content+' changed'})
   expect(button(w,'接受修改').attributes('disabled')).toBeDefined()
   expect(w.text()).toContain('不能应用旧建议')
   expect(w.props('applyEdit')).not.toHaveBeenCalled()
  }finally{w.unmount()}
 })
 it('invalidates consent when the request instruction changes',async()=>{
  const w=create()
  try{
   await configure(w)
   await w.get('.paper-ai__consent input').setValue(true)
   await w.get('[aria-label="AI 修改指令"]').setValue('Different request')
   expect((w.get('.paper-ai__consent input').element as HTMLInputElement).checked).toBe(false)
   expect(button(w,'生成建议').attributes('disabled')).toBeDefined()
   expect(requestPaperAISuggestion).not.toHaveBeenCalled()
  }finally{w.unmount()}
 })
 it('does not carry keys or suggestions across file/account scope changes',async()=>{
  const w=create()
  try{
   await configure(w)
   let resolve!:(value:{text:string;model:string})=>void
   vi.mocked(requestPaperAISuggestion).mockImplementation(()=>new Promise(r=>{resolve=r}))
   await w.get('.paper-ai__consent input').setValue(true)
   await button(w,'生成建议').trigger('click')
   await w.setProps({accountId:'different-owner',projectId:'different-project'})
   await flushPromises()
   resolve({text:'Old private proposal',model:'test-model'})
   await flushPromises()
   expect(w.text()).not.toContain('Old private proposal')
   expect((w.get('[aria-label="AI API Key"]').element as HTMLInputElement).value).toBe('')
  }finally{w.unmount()}
 })
 it('fails closed when the service is disabled',async()=>{
  vi.mocked(getPaperAICapability).mockResolvedValue({...cap,enabled:false})
  const w=create()
  try{
   await flushPromises()
   expect(w.text()).toContain('AI 助手尚未开放')
   expect(w.find('[aria-label="AI API Key"]').exists()).toBe(false)
   expect(requestPaperAISuggestion).not.toHaveBeenCalled()
  }finally{w.unmount()}
 })
})
