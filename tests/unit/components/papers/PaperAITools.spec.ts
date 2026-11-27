import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import {mount,flushPromises} from '@vue/test-utils'
import PaperAITools from '@/components/papers/PaperAITools.vue'
import {getPaperAICapability,requestPaperAISuggestion,discoverPaperAIModels,testPaperAIConnection} from '@/api/papersAI'
import {getPaperFile,type PaperFile} from '@/api/papers'

vi.mock('@/api/papersAI',()=>({getPaperAICapability:vi.fn(),requestPaperAISuggestion:vi.fn(),discoverPaperAIModels:vi.fn(),testPaperAIConnection:vi.fn()}))
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
 it('invalidates an accepted single-file suggestion when an approved context file changes',async()=>{
  const w=create()
  try{
   await configure(w)
   await w.get('.paper-ai__context input[type=checkbox]').setValue(true)
   await flushPromises()
   await w.get('.paper-ai__consent input').setValue(true)
   await button(w,'生成建议').trigger('click')
   await flushPromises()
   expect(button(w,'接受修改').attributes('disabled')).toBeUndefined()
   await w.setProps({files:[file,{...extra,revision:2}]})
   expect(button(w,'接受修改').attributes('disabled')).toBeDefined()
   expect(w.props('applyEdit')).not.toHaveBeenCalled()
  }finally{w.unmount()}
 })
 it('discards late model results when context changes before the provider replies',async()=>{
  const w=create()
  try{
   await configure(w)
   await w.get('.paper-ai__context input[type=checkbox]').setValue(true)
   await flushPromises()
   let resolve!:(value:{text:string;model:string})=>void
   vi.mocked(requestPaperAISuggestion).mockImplementation(()=>new Promise(r=>{resolve=r}))
   await w.get('.paper-ai__consent input').setValue(true)
   await button(w,'生成建议').trigger('click')
   await w.setProps({files:[file,{...extra,revision:2}]})
   resolve({text:'Stale proposed replacement',model:'test-model'})
   await flushPromises()
   expect(w.text()).not.toContain('Stale proposed replacement')
   expect(w.text()).toContain('已丢弃旧响应')
  }finally{w.unmount()}
 })
 it('never displays a credential echoed by the provider',async()=>{
  const w=create()
  try{
   await configure(w)
   vi.mocked(requestPaperAISuggestion).mockResolvedValue({text:'Echo '+key,model:'test-model'})
   await w.get('.paper-ai__consent input').setValue(true)
   await button(w,'生成建议').trigger('click')
   await flushPromises()
   expect(w.text()).not.toContain('Echo '+key)
   expect(button(w,'接受修改')).toBeUndefined()
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

describe('multi-file Agent review and temporary dialogue',()=>{
 const cap2={...cap,project_edits:true,max_history_turns:6,max_history_bytes:16384}
 const file2={...file,content:'Before Original After'}
 const extra2={...extra,content:'Approved references'}
 const projectEdits=[
  {file_id:file2.id,path:file2.path,base_revision:file2.revision,before:'Original',after:'Revised'},
  {file_id:extra2.id,path:extra2.path,base_revision:extra2.revision,before:'references',after:'citations'}
 ]
 beforeEach(()=>{
  vi.resetAllMocks()
  vi.mocked(getPaperAICapability).mockResolvedValue(cap2)
  vi.mocked(getPaperFile).mockResolvedValue(extra2)
  vi.mocked(requestPaperAISuggestion).mockResolvedValue({text:'Review both files',model:'test-model',project_revision:5,edits:projectEdits})
 })
 const create=()=>mount(PaperAITools,{props:{projectId:'project',accountId:'owner',file:file2,source:file2.content,files:[file2,extra2],projectRevision:5,disabled:false,captureSelection:()=>null,applyEdit:vi.fn(()=>true),applyProject:vi.fn(async()=>true)}})
 const button=(w:ReturnType<typeof create>,name:string)=>w.findAll('button').find(b=>b.text()===name)!
 async function prepare(w:ReturnType<typeof create>){
  await flushPromises()
  await w.get('[aria-label="AI API Key"]').setValue('synthetic-test-key')
  await w.get('[aria-label="AI 模型"]').setValue('test-model')
  await button(w,'使用整个文件').trigger('click')
  await w.get('[aria-label="AI 任务类型"]').trigger('click')
  await w.findAll('[role="option"]').find(o=>o.text().includes('跨文件修改'))!.trigger('click')
  await w.get('.paper-ai__context input[type=checkbox]').setValue(true)
  await flushPromises()
  await w.get('[aria-label="AI 修改指令"]').setValue('Review files')
  await w.get('.paper-ai__consent input').setValue(true)
  await button(w,'生成建议').trigger('click')
  await flushPromises()
 }
 it('sends saved source and applies only explicitly checked proposals',async()=>{
  const w=create()
  try{
   await prepare(w)
   expect(requestPaperAISuggestion).toHaveBeenCalledTimes(1)
   expect(vi.mocked(requestPaperAISuggestion).mock.calls[0]?.[1]).toMatchObject({task:'project',project_revision:5,source:file2.content,context:[{file_id:extra2.id,revision:extra2.revision}],consent:true})
   expect(w.text()).toContain('Agent 跨文件修改计划')
   expect(button(w,'应用已选修改（0）').attributes('disabled')).toBeDefined()
   expect(w.props('applyProject')).not.toHaveBeenCalled()
   await w.findAll('.paper-ai__result input[type=checkbox]')[1]!.setValue(true)
   await button(w,'应用已选修改（1）').trigger('click')
   await flushPromises()
   expect(w.props('applyProject')).toHaveBeenCalledWith(5,[{file_id:extra2.id,base_revision:extra2.revision,content:'Approved citations'}])
   expect(w.props('applyEdit')).not.toHaveBeenCalled()
  }finally{w.unmount()}
 })
 it('refuses a stale project revision and clears review when provider configuration changes',async()=>{
  const w=create()
  try{
   await prepare(w)
   await w.findAll('.paper-ai__result input[type=checkbox]')[0]!.setValue(true)
   await w.setProps({projectRevision:6})
   expect(button(w,'应用已选修改（1）').attributes('disabled')).toBeDefined()
   expect(w.props('applyProject')).not.toHaveBeenCalled()
   await w.get('[aria-label="AI API Key"]').setValue('another-synthetic-key')
   expect(w.find('.paper-ai__result').exists()).toBe(false)
   expect(w.text()).not.toContain('本轮对话（1 轮）')
  }finally{w.unmount()}
 })
 it('includes previewed history on a consented follow-up, and excludes it when unchecked',async()=>{
  const w=create()
  try{
   await prepare(w)
   expect(w.text()).toContain('本轮对话（1 轮）')
   await w.get('[aria-label="AI 修改指令"]').setValue('Follow up')
   expect(button(w,'生成建议').attributes('disabled')).toBeDefined()
   await w.get('.paper-ai__consent input').setValue(true)
   await button(w,'生成建议').trigger('click')
   await flushPromises()
   expect(vi.mocked(requestPaperAISuggestion).mock.calls[1]?.[1].history).toEqual([{task:'project',instruction:'Review files',reply:JSON.stringify({summary:'Review both files',edits:projectEdits})}])
   const label=w.findAll('label').find(el=>el.text().includes('继续对话：'))
   await label!.get('input').setValue(false)
   await w.get('.paper-ai__consent input').setValue(true)
   await button(w,'生成建议').trigger('click')
   await flushPromises()
   expect(vi.mocked(requestPaperAISuggestion).mock.calls[2]?.[1].history).toBeUndefined()
  }finally{w.unmount()}
 })
})

describe('custom compatible providers and model discovery',()=>{
 const capability={...cap,custom_base_urls:true,model_discovery:true}
 const create=()=>mount(PaperAITools,{props:{projectId:'project',accountId:'owner',file,source:file.content,files:[file,extra],disabled:false,captureSelection:()=>null,applyEdit:vi.fn(()=>true)}})
 const button=(w:ReturnType<typeof create>,name:string)=>w.findAll('button').find(b=>b.text()===name)!
 const custom='https://provider.example.net/openai/v1'
 beforeEach(()=>{
  vi.resetAllMocks()
  vi.mocked(getPaperAICapability).mockResolvedValue(capability)
  vi.mocked(discoverPaperAIModels).mockResolvedValue({models:['z-chat','provider/chat','z-chat'],truncated:false})
 })
 async function configure(w:ReturnType<typeof create>){
  await flushPromises()
  await w.get('[aria-label="AI API 地址"]').setValue(custom)
  await w.get('[aria-label="AI API Key"]').setValue(key)
 }
 it('requests only the approved provider URL and key, and supports model selection or manual entry',async()=>{
  const w=create()
  try{
   await configure(w)
   expect(discoverPaperAIModels).not.toHaveBeenCalled()
   expect(button(w,'获取模型列表').attributes('disabled')).toBeUndefined()
   await button(w,'获取模型列表').trigger('click');await flushPromises()
   expect(discoverPaperAIModels).toHaveBeenCalledWith('project',{base_url:custom,api_key:key,consent:true},expect.any(AbortSignal))
   expect(requestPaperAISuggestion).not.toHaveBeenCalled()
   expect(w.text()).toContain('已获取 2 个模型')
   await w.get('[aria-label="可用模型"]').trigger('click')
   await w.findAll('[role="option"]').find(o=>o.text()==='provider/chat')!.trigger('click')
   expect((w.get('[aria-label="AI 模型"]').element as HTMLInputElement).value).toBe('provider/chat')
   await w.get('[aria-label="AI 模型"]').setValue('manual-model')
   expect((w.get('[aria-label="AI 模型"]').element as HTMLInputElement).value).toBe('manual-model')
  }finally{w.unmount()}
 })
 it('accepts a complete endpoint URL without duplicating the API path',async()=>{
  const w=create()
  try{
   await flushPromises()
   await w.get('[aria-label="AI API 地址"]').setValue(custom+'/chat/completions')
   await w.get('[aria-label="AI API Key"]').setValue(key)
   await button(w,'获取模型列表').trigger('click');await flushPromises()
   expect(discoverPaperAIModels).toHaveBeenCalledWith('project',{base_url:custom,api_key:key,consent:true},expect.any(AbortSignal))
  }finally{w.unmount()}
 })
 it('fills the successful base without clearing the API key and uses it for chat',async()=>{
  const w=create()
  const entered='provider.example.net/openai'
  vi.mocked(discoverPaperAIModels).mockResolvedValue({models:['model/chat'],truncated:false,resolved_base_url:custom})
  try{
   await flushPromises()
   await w.get('[aria-label="AI API 地址"]').setValue(entered)
   await w.get('[aria-label="AI API Key"]').setValue(key)
   await button(w,'获取模型列表').trigger('click');await flushPromises()
   expect(discoverPaperAIModels).toHaveBeenCalledWith('project',{base_url:'https://'+entered,api_key:key,consent:true},expect.any(AbortSignal))
   expect((w.get('[aria-label="AI API 地址"]').element as HTMLInputElement).value).toBe(custom)
   expect((w.get('[aria-label="AI API Key"]').element as HTMLInputElement).value).toBe(key)
   expect(w.text()).toContain('已自动修正 API 地址')
   expect(w.text()).toContain('已获取 1 个模型')
   expect(button(w,'获取模型列表').attributes('disabled')).toBeUndefined()
   await w.get('[aria-label="AI 模型"]').setValue('model/chat')
   await button(w,'使用整个文件').trigger('click')
   await w.get('[aria-label="AI 修改指令"]').setValue('Review this fixture')
   await w.get('.paper-ai__consent input').setValue(true)
   vi.mocked(requestPaperAISuggestion).mockResolvedValue({text:'Suggested source',model:'model/chat'})
   await button(w,'生成建议').trigger('click');await flushPromises()
   expect(requestPaperAISuggestion).toHaveBeenCalledWith('project',expect.objectContaining({base_url:custom,model:'model/chat',api_key:key}),expect.any(AbortSignal))
   await w.get('[aria-label="AI API 地址"]').setValue('https://another.example.net/v1')
   expect((w.get('[aria-label="AI API Key"]').element as HTMLInputElement).value).toBe('')
  }finally{w.unmount()}
 })
 it('rejects unexpected resolved origins or unrelated same-origin paths',async()=>{
  for(const resolved of ['https://other.example.net/v1','https://provider.example.net/unrelated/v1']){
   const w=create()
   vi.mocked(discoverPaperAIModels).mockResolvedValue({models:['forged-model'],truncated:false,resolved_base_url:resolved})
   try{
    await configure(w)
    await button(w,'获取模型列表').trigger('click');await flushPromises()
    expect((w.get('[aria-label="AI API 地址"]').element as HTMLInputElement).value).toBe(custom)
    expect((w.get('[aria-label="AI API Key"]').element as HTMLInputElement).value).toBe(key)
    expect(w.find('[aria-label="可用模型"]').exists()).toBe(false)
    expect(w.text()).not.toContain('forged-model')
    expect(w.text()).not.toContain(resolved)
   }finally{w.unmount()}
  }
 })
 it('starts with two connection fields, picks a listed chat model and remembers the validated config',async()=>{
  const w=create()
  vi.mocked(discoverPaperAIModels).mockResolvedValue({models:['text-embedding-3-small','gpt-4o-mini'],truncated:false,resolved_base_url:custom})
  try{
   await configure(w)
   expect((w.get('[aria-label="AI 模型"]').element as HTMLInputElement).closest<HTMLElement>('.p-field')?.style.display).toBe('none')
   expect(w.find('[aria-label="可用模型"]').exists()).toBe(false)
   await button(w,'获取模型列表').trigger('click');await flushPromises()
   expect((w.get('[aria-label="AI 模型"]').element as HTMLInputElement).value).toBe('gpt-4o-mini')
   expect(w.get('[aria-label="可用模型"]').isVisible()).toBe(true)
   expect((w.get('[aria-label="AI 模型"]').element as HTMLInputElement).closest<HTMLElement>('.p-field')?.style.display).toBe('none')
   expect(w.emitted('connection')?.at(-1)?.[0]).toEqual({accountId:'owner',projectId:'project',baseURL:custom,key,model:'gpt-4o-mini',models:['gpt-4o-mini','text-embedding-3-small']})
   expect(requestPaperAISuggestion).not.toHaveBeenCalled()
   await button(w,'清除配置').trigger('click')
   expect((w.get('[aria-label="AI API Key"]').element as HTMLInputElement).value).toBe('')
   expect(w.emitted('connection')?.at(-1)?.[0]).toBeNull()
  }finally{w.unmount()}
 })
 it('advances after discovery, explains blockers, and tests chat only on an explicit click',async()=>{
  vi.mocked(getPaperAICapability).mockResolvedValue({...capability,connection_test:true})
  vi.mocked(discoverPaperAIModels).mockResolvedValue({models:['gpt-4o-mini','provider/chat'],truncated:false,resolved_base_url:custom})
  vi.mocked(testPaperAIConnection).mockResolvedValue({connected:true})
  const w=create()
  try{
   await flushPromises()
   expect(w.find('.paper-ai__generation-blocker').text()).toContain('API Key')
   await configure(w)
   expect(w.find('.paper-ai__generation-blocker').text()).toContain('聊天模型')
   await button(w,'获取模型列表').trigger('click');await flushPromises()
   expect(w.get('.paper-ai__settings').attributes('open')).toBeUndefined()
   expect(w.get('.paper-ai__settings > summary').text()).toContain('gpt-4o-mini')
   expect(testPaperAIConnection).not.toHaveBeenCalled()
   expect(requestPaperAISuggestion).not.toHaveBeenCalled()
   await button(w,'测试聊天（可能计费）').trigger('click');await flushPromises()
   expect(testPaperAIConnection).toHaveBeenCalledTimes(1)
   expect(testPaperAIConnection).toHaveBeenCalledWith('project',{base_url:custom,api_key:key,model:'gpt-4o-mini',consent:true},expect.any(AbortSignal))
   expect(w.get('.paper-ai__settings > summary').text()).toContain('聊天已验证')
   expect(w.emitted('connection')?.at(-1)?.[0]).toMatchObject({chatTested:true,key,model:'gpt-4o-mini'})
   expect(requestPaperAISuggestion).not.toHaveBeenCalled()
   await button(w,'使用整个文件').trigger('click')
   expect(w.find('.paper-ai__generation-blocker').text()).toContain('任务指令')
   await w.get('[aria-label="AI 修改指令"]').setValue('Review this fixture')
   expect(w.find('.paper-ai__generation-blocker').text()).toContain('发送范围确认')
   expect(button(w,'生成建议').attributes('disabled')).toBeDefined()
   await w.get('.paper-ai__consent input').setValue(true)
   expect(button(w,'生成建议').attributes('disabled')).toBeUndefined()
   await w.get('[aria-label="AI 模型"]').setValue('provider/chat')
   expect(w.get('.paper-ai__settings > summary').text()).not.toContain('聊天已验证')
   expect(w.emitted('connection')?.at(-1)?.[0]).not.toHaveProperty('chatTested')
   expect(button(w,'生成建议').attributes('disabled')).toBeDefined()
  }finally{w.unmount()}
 })
 it('cancels stale chat tests when the endpoint or credential changes',async()=>{
  vi.mocked(getPaperAICapability).mockResolvedValue({...capability,connection_test:true})
  vi.mocked(discoverPaperAIModels).mockResolvedValue({models:['gpt-4o-mini'],truncated:false,resolved_base_url:custom})
  let finish!:(value:{connected:boolean})=>void
  vi.mocked(testPaperAIConnection).mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
  const w=create()
  try{
   await configure(w)
   await button(w,'获取模型列表').trigger('click');await flushPromises()
   await button(w,'测试聊天（可能计费）').trigger('click')
   const signal=vi.mocked(testPaperAIConnection).mock.calls[0]![2]!
   await w.get('[aria-label="AI API Key"]').setValue('replacement-synthetic-key')
   expect(signal.aborted).toBe(true)
   finish({connected:true});await flushPromises()
   expect(w.get('.paper-ai__settings > summary').text()).not.toContain('聊天已验证')
   expect(w.text()).not.toContain('聊天连接测试成功')
   expect(w.emitted('connection')?.at(-1)?.[0]).toBeNull()
   expect(requestPaperAISuggestion).not.toHaveBeenCalled()
  }finally{w.unmount()}
 })
 it('restores only a matching in-memory project connection, without repeating discovery',async()=>{
  const connection={accountId:'owner',projectId:'project',baseURL:custom,key,model:'provider/chat',models:['provider/chat']}
  const w=create()
  try{
   await w.setProps({savedConnection:connection})
   await flushPromises()
   expect((w.get('[aria-label="AI API Key"]').element as HTMLInputElement).value).toBe(key)
   expect((w.get('[aria-label="AI 模型"]').element as HTMLInputElement).value).toBe('provider/chat')
   expect(discoverPaperAIModels).not.toHaveBeenCalled()
   await w.setProps({accountId:'other-owner'})
   await flushPromises()
   expect((w.get('[aria-label="AI API Key"]').element as HTMLInputElement).value).toBe('')
   expect(w.find('[aria-label="可用模型"]').exists()).toBe(false)
  }finally{w.unmount()}
 })
 it('rejects private/invalid addresses and clears keys and old models on provider change',async()=>{
  const w=create()
  try{
   await configure(w)
   await button(w,'获取模型列表').trigger('click');await flushPromises()
   expect(w.get('[aria-label="可用模型"]').exists()).toBe(true)
   await w.get('[aria-label="AI API 地址"]').setValue('https://127.0.0.1/v1')
   expect((w.get('[aria-label="AI API Key"]').element as HTMLInputElement).value).toBe('')
   expect(w.find('[aria-label="可用模型"]').exists()).toBe(false)
   await w.get('[aria-label="AI API Key"]').setValue(key)
   expect(button(w,'获取模型列表').attributes('disabled')).toBeDefined()
   expect(discoverPaperAIModels).toHaveBeenCalledTimes(1)
  }finally{w.unmount()}
 })
 it('ignores delayed responses after API address or account changes',async()=>{
  const w=create()
  let finish!:(value:{models:string[];truncated:boolean})=>void
  vi.mocked(discoverPaperAIModels).mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
  try{
   await configure(w)
   await button(w,'获取模型列表').trigger('click')
   const signal=vi.mocked(discoverPaperAIModels).mock.calls[0]![2]!
   await w.get('[aria-label="AI API 地址"]').setValue('https://another.example.net/v1')
   expect(signal.aborted).toBe(true)
   finish({models:['old-private-model'],truncated:false})
   await flushPromises()
   expect(w.text()).not.toContain('old-private-model')
   expect(w.find('[aria-label="可用模型"]').exists()).toBe(false)
   expect((w.get('[aria-label="AI API Key"]').element as HTMLInputElement).value).toBe('')
  }finally{w.unmount()}
 })
 it('keeps manual model entry when listing is unsupported or returns no models',async()=>{
  const w=create()
  vi.mocked(discoverPaperAIModels).mockRejectedValue(new Error('synthetic unavailable'))
  try{
   await configure(w)
   await button(w,'获取模型列表').trigger('click');await flushPromises()
   expect(w.text()).toContain('也可手动输入模型 ID')
   await w.get('[aria-label="AI 模型"]').setValue('manual-chat')
   await button(w,'使用整个文件').trigger('click')
   await w.get('[aria-label="AI 修改指令"]').setValue('Review this fixture')
   await w.get('.paper-ai__consent input').setValue(true)
   vi.mocked(requestPaperAISuggestion).mockResolvedValue({text:'Suggested source',model:'manual-chat'})
   await button(w,'生成建议').trigger('click');await flushPromises()
   expect(requestPaperAISuggestion).toHaveBeenCalledWith('project',expect.objectContaining({base_url:custom,model:'manual-chat',api_key:key}),expect.any(AbortSignal))
  }finally{w.unmount()}
 })
})
