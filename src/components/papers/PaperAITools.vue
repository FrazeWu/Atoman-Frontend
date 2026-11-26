<template>
 <section class="paper-ai" aria-label="AI 修改建议">
  <p v-if="loading" role="status">正在检查 AI 服务…</p>
  <div v-else-if="!capability?.enabled" class="paper-ai__notice">
   <strong>AI 助手尚未开放</strong><p>{{ message||'源码编辑不受影响。' }}</p>
   <PButton size="sm" variant="secondary" type="button" @click="loadCapability">重新检查</PButton>
  </div>
  <template v-else>
   <details class="paper-ai__settings" open>
    <summary>模型与 API 设置</summary>
    <label>API 地址<select v-model="baseURL" aria-label="AI API 地址" :disabled="busy"><option v-for="url in capability.base_urls" :key="url" :value="url">{{ url }}</option></select></label>
    <label>模型<input v-model.trim="model" aria-label="AI 模型" maxlength="128" placeholder="例如 gpt-4.1-mini" :disabled="busy" /></label>
    <label>API Key<input v-model="key" type="password" autocomplete="off" spellcheck="false" aria-label="AI API Key" maxlength="2048" :disabled="busy" placeholder="使用你的模型账户密钥" /></label>
    <p>密钥仅保留在当前面板内存中，关闭即清除，不写入数据库或浏览器存储。模型调用由你的 API 账户计费。其他兼容 API 地址需由服务器批准后才会出现在列表中。</p>
   </details>
   <div class="paper-ai__row">
    <PButton type="button" size="sm" variant="secondary" :disabled="busy||disabled" @click="capture(true)">使用编辑器选区</PButton>
    <PButton type="button" size="sm" variant="secondary" :disabled="busy||disabled" @click="capture(false)">使用整个文件</PButton>
   </div>
   <p v-if="collaborationEpoch">实时协作：仅处理已获服务器确认的当前版本；接受的建议作为你的本地编辑同步，断线或未确认时暂停操作。</p>
   <p v-if="!target">请选择源码范围。也可先在编辑器选中段落，再点击「使用编辑器选区」。</p>
   <div v-else class="paper-ai__context">
    <strong>{{ file.path }} · {{ target.from===0&&target.to===target.baseline.length?'整个文件':'选中文本' }}</strong>
    <small>{{ sourceBytes.toLocaleString() }} 字节 · {{ stale?'原稿已变化，请重新选取':'待发送源码' }}</small>
    <details open><summary>预览待发送源码</summary><pre>{{ selectedSource }}</pre></details>
   </div>
   <details class="paper-ai__context">
    <summary>附加项目文件（{{ extras.length }}/{{ capability.max_extra_files }}）</summary>
    <p>{{task==='project'?'仅允许 Agent 提议修改当前完整文件及下面勾选、预览的文件。':'仅发送下方主动选择并成功预览的已保存文本文件，不发送图片或其他项目内容。'}}</p>
    <label v-for="item in eligibleFiles" :key="item.id" class="paper-ai__check">
     <input type="checkbox" :checked="extras.some(extra=>extra.id===item.id)" :disabled="busy||contextBusy||(!extras.some(extra=>extra.id===item.id)&&extras.length>=capability.max_extra_files)" @change="toggleContext(item,($event.target as HTMLInputElement).checked)" /><span>{{ item.path }}</span>
    </label>
    <p v-if="contextBusy">读取文件预览中…</p>
    <details v-for="extra in extras" :key="extra.id"><summary>{{ extra.path }} · v{{ extra.revision }}</summary><pre>{{ extra.content }}</pre></details>
   </details>
   <label>任务类型<select v-model="task" :disabled="busy" aria-label="AI 任务类型"><option value="revise">修改源码（可审阅后接受）</option><option value="explain">解释、分析或排查</option><option v-if="projectModeAvailable" value="project">Agent · 跨文件修改</option></select></label>
   <p v-if="task==='project'">使用已保存的完整文件。每个文件最多一处连续替换，审阅并勾选后才能提交。该操作仅在普通编辑模式开放，可能使其他协作者的旧会话失效，请先协调。</p>
   <p v-if="task==='project'&&!projectReady" role="status">请先保存源码并选择整个文件，再生成跨文件建议。</p>
   <details v-if="historyAvailable&&history.length" class="paper-ai__context" open>
    <summary>本轮对话（{{history.length}} 轮）</summary>
    <label class="paper-ai__check"><input v-model="includeHistory" type="checkbox" :disabled="busy" /><span>继续对话：发送以下已预览的历史记录</span></label>
    <div v-for="(turn,index) in history" :key="index" class="paper-ai__turn">
     <strong>你 · 第 {{index+1}} 轮</strong><pre>{{turn.instruction}}</pre>
     <strong>AI 建议（不表示已应用）</strong><pre>{{turn.reply}}</pre>
    </div>
    <small>最多 {{capability.max_history_turns}} 轮、{{capability.max_history_bytes}} 字节；关闭面板、切换文件或模型配置后清除。</small>
    <PButton type="button" size="sm" variant="secondary" :disabled="busy" @click="clearHistory">开始新对话</PButton>
   </details>
   <div class="paper-ai__row">
    <button type="button" :disabled="busy" @click="preset('润色这段论文，保持研究事实、数值、引用键和 LaTeX 结构。','revise')">学术润色</button>
    <button type="button" :disabled="busy" @click="preset('将这段论文翻译为英文，保留 LaTeX 命令、公式和引用。','revise')">英文翻译</button>
    <button type="button" :disabled="busy" @click="preset('检查 LaTeX 语法和学术表达，解释问题并提出具体修改建议。','explain')">源码检查</button>
    <button v-if="diagnostics" type="button" :disabled="busy" @click="diagnosticPreset">分析编译错误</button>
   </div>
   <label>给 AI 的指令<textarea v-model="instruction" aria-label="AI 修改指令" rows="3" maxlength="4000" :disabled="busy" placeholder="描述需要完成的任务…" /></label>
   <label class="paper-ai__check paper-ai__consent"><input v-model="consent" type="checkbox" :disabled="busy" /> <span>我确认将上方预览的源码、附加文件和指令以及勾选的对话历史发送到所选模型服务，允许该服务处理这些内容。</span></label>
   <p>{{ contextBytes.toLocaleString() }} / {{ capability.max_context_bytes.toLocaleString() }} 字节 · 每次最多生成 4096 tokens</p>
   <div class="paper-ai__row">
    <PButton size="sm" type="button" :disabled="!canGenerate" @click="generate">{{ busy?'生成中…':'生成建议' }}</PButton>
    <PButton v-if="busy" size="sm" type="button" variant="secondary" @click="cancel">取消等待</PButton>
   </div>
   <p v-if="message" role="status">{{ message }}</p>
   <section v-if="suggestion" class="paper-ai__result">
    <strong>{{ suggestion.task==='project'?'Agent 跨文件修改计划':suggestion.task==='revise'?'待审阅修改':'AI 分析结果' }}</strong>
    <small v-if="suggestion.response.input_tokens||suggestion.response.output_tokens">输入 {{ suggestion.response.input_tokens||0 }} · 输出 {{ suggestion.response.output_tokens||0 }} tokens</small>
    <div v-if="suggestion.task==='revise'" class="paper-ai__diff">
     <div><strong>原文</strong><pre>{{ suggestion.target.baseline.slice(suggestion.target.from,suggestion.target.to) }}</pre></div>
     <div><strong>建议替换为</strong><pre>{{ suggestion.response.text }}</pre></div>
    </div>
    <pre v-else>{{ suggestion.response.text }}</pre>
    <template v-if="suggestion.task==='project'">
     <p v-if="!suggestion.changes?.length">没有需要修改的文件。</p>
     <div v-for="change in suggestion.changes||[]" :key="change.file_id" class="paper-ai__context">
      <label class="paper-ai__check"><input type="checkbox" :checked="approved.includes(change.file_id)" :disabled="busy||disabled||resultStale" @change="approve(change.file_id,($event.target as HTMLInputElement).checked)" /><strong>{{change.path}} · v{{change.base_revision}}</strong></label>
      <div class="paper-ai__diff">
       <div><strong>原文</strong><pre>{{change.before}}</pre></div>
       <div><strong>建议替换为</strong><pre>{{change.after||'（删除该片段）'}}</pre></div>
      </div>
     </div>
     <PButton v-if="suggestion.changes?.length" type="button" size="sm" :disabled="resultStale||disabled||busy||!approved.length" @click="acceptProject">应用已选修改（{{approved.length}}）</PButton>
    </template>
    <p v-if="resultStale">当前源码或文件版本已变化，不能应用旧建议，请重新生成。</p>
    <div class="paper-ai__row">
     <PButton v-if="suggestion.task==='revise'" type="button" size="sm" :disabled="resultStale||disabled||busy" @click="accept">接受修改</PButton>
     <PButton type="button" size="sm" variant="secondary" @click="discard">丢弃建议</PButton>
    </div>
   </section>
  </template>
 </section>
</template>

<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref,shallowRef,watch} from 'vue'
import PButton from '@/components/ui/PButton.vue'
import {getPaperFile,type PaperFile,type PaperTextReplacement} from '@/api/papers'
import {ApiErrorResponseError} from '@/api/client'
import {getPaperAICapability,requestPaperAISuggestion,type PaperAICapability,type PaperAISuggestion,type PaperAITask,type PaperAIHistoryTurn} from '@/api/papersAI'
import {paperAIBytes,validAIRange,type PaperAISourceRange,type PaperAIEdit} from './aiSuggestion'
import {reviewProjectEdits,appendAgentHistory,type ReviewedPaperAIChange} from './aiAgent'

type Captured=PaperAISourceRange&{fileId:string;revision:number;collaborationEpoch?:string}
type Suggestion={target:Captured;task:PaperAITask;response:PaperAISuggestion;changes?:ReviewedPaperAIChange[];context?:PaperFile[]}
const props=defineProps<{projectId:string;accountId:string;file:PaperFile;source:string;files:PaperFile[];disabled:boolean;captureSelection:()=>PaperAISourceRange|null;applyEdit:(edit:PaperAIEdit)=>boolean;diagnostics?:string;collaborationEpoch?:string;projectRevision?:number;applyProject?:(revision:number,replacements:PaperTextReplacement[])=>Promise<boolean>}>()
const capability=ref<PaperAICapability|null>(null),loading=ref(false),message=ref('')
const baseURL=ref(''),model=ref('gpt-4.1-mini'),key=ref(''),instruction=ref(''),task=ref<PaperAITask>('revise'),consent=ref(false)
const target=shallowRef<Captured|null>(null),extras=shallowRef<PaperFile[]>([])
const suggestion=shallowRef<Suggestion|null>(null)
const history=shallowRef<PaperAIHistoryTurn[]>([]),includeHistory=ref(true),approved=ref<string[]>([])
const historyAvailable=computed(()=>Number.isSafeInteger(capability.value?.max_history_turns)&&Number.isSafeInteger(capability.value?.max_history_bytes)&&(capability.value?.max_history_turns||0)>0&&(capability.value?.max_history_bytes||0)>0)
const projectModeAvailable=computed(()=>capability.value?.project_edits===true&&!props.collaborationEpoch&&!!props.applyProject&&Number.isSafeInteger(props.projectRevision)&&(props.projectRevision||0)>0)
const projectReady=computed(()=>projectModeAvailable.value&&!!target.value&&target.value.from===0&&target.value.to===target.value.baseline.length&&target.value.baseline===props.file.content&&props.source===props.file.content)
const busy=ref(false),contextBusy=ref(false)
let disposed=false,serial=0,contextSerial=0,controller:AbortController|null=null
const scope=()=>props.accountId+':'+props.projectId+':'+props.file.id+':'+(props.collaborationEpoch||'ordinary')
const selectedSource=computed(()=>target.value?target.value.baseline.slice(target.value.from,target.value.to):'')
const sourceBytes=computed(()=>paperAIBytes(selectedSource.value))
const contextBytes=computed(()=>sourceBytes.value+extras.value.reduce((n,item)=>n+paperAIBytes(item.content),0))
const eligibleFiles=computed(()=>props.files.filter(item=>item.kind==='text'&&item.id!==props.file.id))
const staleTarget=(item:Captured|null)=>!item||item.fileId!==props.file.id||item.revision!==props.file.revision||item.baseline!==props.source||item.collaborationEpoch!==props.collaborationEpoch
const stale=computed(()=>staleTarget(target.value))
const resultStale=computed(()=>{
 const item=suggestion.value
 if(!item||staleTarget(item.target))return true
 if(item.task!=='project')return false
 return !projectModeAvailable.value||!projectReady.value||item.response.project_revision!==props.projectRevision||!!item.context?.some(f=>!props.files.some(current=>current.id===f.id&&current.revision===f.revision&&current.path===f.path))
})
const extraStale=computed(()=>extras.value.some(extra=>!eligibleFiles.value.some(item=>item.id===extra.id&&item.revision===extra.revision)))
const canGenerate=computed(()=>!!capability.value?.enabled&&!!target.value&&!stale.value&&!extraStale.value&&!props.disabled&&!busy.value&&!contextBusy.value&&consent.value&&baseURL.value&&model.value&&key.value.trim().length>=8&&instruction.value.trim()&&selectedSource.value.trim()&&sourceBytes.value<=capability.value.max_source_bytes&&contextBytes.value<=capability.value.max_context_bytes&&paperAIBytes(instruction.value)<=4000&&(task.value!=='project'||projectReady.value))
function alive(n:number,initial:string){return !disposed&&n===serial&&initial===scope()}
function clearConsent(){consent.value=false}
watch([baseURL,model,key,instruction,task,target,extras,()=>props.source,()=>props.file.revision,()=>props.disabled,()=>props.projectRevision,extraStale,includeHistory,history],clearConsent,{flush:'sync'})
function stop(){serial++;controller?.abort();controller=null;busy.value=false;loading.value=false;clearConsent()}
function reset(){stop();contextSerial++;contextBusy.value=false;capability.value=null;key.value='';target.value=null;extras.value=[];suggestion.value=null;history.value=[];approved.value=[];task.value='revise';includeHistory.value=true;message.value=''}
watch([baseURL,model,key],()=>{history.value=[];suggestion.value=null;approved.value=[]},{flush:'sync'})
watch(projectModeAvailable,available=>{if(!available&&task.value==='project')task.value='revise'})
function clearHistory(){if(!busy.value){history.value=[];suggestion.value=null;approved.value=[];message.value='已开始新对话。'}}
function approve(id:string,checked:boolean){
 if(busy.value||props.disabled||resultStale.value||!suggestion.value?.changes?.some(change=>change.file_id===id))return
 approved.value=checked?[...new Set([...approved.value,id])]:approved.value.filter(value=>value!==id)
}
watch(scope,()=>{reset();void loadCapability()})
onBeforeUnmount(()=>{disposed=true;reset()})
onMounted(()=>void loadCapability())
async function loadCapability(){
 if(disposed||busy.value||loading.value)return
 const n=++serial,initial=scope(),abort=new AbortController()
 controller=abort;loading.value=true;message.value=''
 try{
  const value=await getPaperAICapability(props.projectId,abort.signal)
  if(!alive(n,initial))return
  if(!Array.isArray(value.base_urls)||!value.base_urls.length||value.max_source_bytes<=0||value.max_context_bytes<=0||value.max_extra_files<0)throw new Error('invalid capability')
  capability.value=value
  baseURL.value=value.base_urls[0]||''
  if(value.enabled)capture(!!props.captureSelection())
 }catch{if(alive(n,initial)){capability.value=null;message.value='暂时无法获取 AI 服务能力，请稍后重试。'}}
 finally{if(alive(n,initial)){loading.value=false;controller=null}}
}
function capture(selectionOnly:boolean){
 if(busy.value||props.disabled)return
 const range=selectionOnly?props.captureSelection():{from:0,to:props.source.length,baseline:props.source}
 if(!range||range.baseline!==props.source||!validAIRange(range)){message.value=selectionOnly?'请先在源码编辑器中选中需要处理的文字。':'当前文件没有可处理的源码。';return}
 if(capability.value&&paperAIBytes(range.baseline.slice(range.from,range.to))>capability.value.max_source_bytes){message.value='源码范围过大，请缩小选区。';return}
 target.value={...range,fileId:props.file.id,revision:props.file.revision,...(props.collaborationEpoch?{collaborationEpoch:props.collaborationEpoch}:{})}
 suggestion.value=null;message.value='';clearConsent()
}
async function toggleContext(file:PaperFile,checked:boolean){
 if(busy.value||contextBusy.value||disposed||!capability.value)return
 if(!checked){extras.value=extras.value.filter(item=>item.id!==file.id);return}
 if(extras.value.length>=capability.value.max_extra_files)return
 const n=++contextSerial,initial=scope();contextBusy.value=true;message.value=''
 try{
  const loaded=await getPaperFile(props.projectId,file.id)
  if(disposed||n!==contextSerial||initial!==scope())return
  if(loaded.id!==file.id||loaded.kind!=='text'||loaded.revision!==file.revision||!eligibleFiles.value.some(item=>item.id===file.id&&item.revision===file.revision))throw new Error('changed')
  if(paperAIBytes(loaded.content)>32*1024||contextBytes.value+paperAIBytes(loaded.content)>capability.value.max_context_bytes){message.value='附加文件过大，未加入发送范围。';return}
  extras.value=[...extras.value,loaded]
 }catch{if(!disposed&&initial===scope()&&n===contextSerial)message.value='无法读取选定文件，请刷新项目后重试。'}
 finally{if(n===contextSerial)contextBusy.value=false}
}
function preset(value:string,mode:PaperAITask){if(busy.value)return;instruction.value=value;task.value=mode}
function diagnosticPreset(){preset('分析以下编译错误，注意行号可能对应之前的编译版本。不要编造内容：\\n'+(props.diagnostics||'').slice(0,1800),'explain')}
function cancel(){stop();message.value='已取消等待；如果模型服务已收到请求，仍可能产生费用。'}
function discard(){suggestion.value=null;approved.value=[];message.value='已丢弃建议，原稿未修改。'}
async function generate(){
 if(!canGenerate.value||!target.value||disposed)return
 const captured={...target.value},mode=task.value,initial=scope(),n=++serial,abort=new AbortController()
 controller=abort;busy.value=true;message.value='';suggestion.value=null;approved.value=[]
 const context=extras.value.map(item=>({...item})),base=props.projectRevision
 const currentFile={...props.file,content:captured.baseline}
 const request={base_url:baseURL.value,model:model.value,api_key:key.value.trim(),file_id:captured.fileId,base_revision:captured.revision,source:selectedSource.value,task:mode,instruction:instruction.value,context:context.map(item=>({file_id:item.id,revision:item.revision})),consent:true as const,...(historyAvailable.value&&includeHistory.value&&history.value.length?{history:[...history.value]}:{}),...(mode==='project'?{project_revision:base}:{})}
 clearConsent()
 try{
  const response=await requestPaperAISuggestion(props.projectId,request,abort.signal)
  if(!alive(n,initial))return
  if(typeof response.text!=='string'||!response.text.trim()||paperAIBytes(response.text)>48*1024)throw new Error('invalid result')
  let changes:ReviewedPaperAIChange[]|undefined
  if(mode==='project'){
   if(response.project_revision!==base)throw new Error('Invalid plan revision')
   changes=reviewProjectEdits([currentFile,...context],response.edits??[])
   if(!changes)throw new Error('Invalid project plan')
  }
  suggestion.value={target:captured,task:mode,response,changes,context}
  if(historyAvailable.value&&capability.value){
   const reply=mode==='project'?JSON.stringify({summary:response.text,edits:response.edits||[]}):response.text
   history.value=appendAgentHistory(history.value,{task:mode,instruction:request.instruction,reply},Math.min(capability.value.max_history_turns||0,6),Math.min(capability.value.max_history_bytes||0,16384))
  }
  message.value=mode==='project'?'Agent 计划已生成，尚未修改任何文件。':mode==='revise'?'修改建议已生成，尚未修改源码。':'分析已完成。'
 }catch(cause){
  if(!alive(n,initial))return
  const code=cause instanceof ApiErrorResponseError?cause.code:''
  message.value=code==='papers.ai_context_changed'?'服务器文件版本已变化，请刷新项目并重新确认上下文。':code==='papers.ai_provider_auth'?'模型服务拒绝了 API Key，请核对密钥及权限。':code==='papers.ai_provider_rate'?'模型服务限流或额度不足。':code==='papers.ai_endpoint_denied'?'该 API 地址尚未获服务器批准。':code==='papers.ai_busy'?'AI 请求容量已满，请稍后重试。':code==='papers.ai_invalid_project_response'?'模型给出的文件或片段无法安全匹配，请缩小任务或重新生成。':code==='papers.ai_incomplete_response'?'模型输出不完整，请缩小源码范围或任务。':'生成失败，请检查模型、API Key 和网络，原稿未修改。'
 }finally{if(alive(n,initial)){busy.value=false;controller=null}}
}
async function acceptProject(){
 const item=suggestion.value
 if(!item||item.task!=='project'||!item.changes||resultStale.value||props.disabled||busy.value||!props.applyProject||!item.response.project_revision)return
 const chosen=item.changes.filter(change=>approved.value.includes(change.file_id))
 if(!chosen.length)return
 const n=++serial,initial=scope()
 busy.value=true;message.value=''
 try{
  const saved=await props.applyProject(item.response.project_revision,chosen.map(({file_id,base_revision,content})=>({file_id,base_revision,content})))
  if(!alive(n,initial))return
  if(!saved){message.value='未确认提交成功。若项目版本变化或网络中断，请刷新服务器版本后再重新生成，避免重复提交。';return}
  suggestion.value=null;approved.value=[];target.value=null;extras.value=[]
  message.value='已原子提交所选文件修改，原版本保留在文件历史中。'
 }catch{if(alive(n,initial))message.value='提交未确认，请核对服务器版本后重试。'}
 finally{if(alive(n,initial))busy.value=false}
}
function accept(){
 const item=suggestion.value
 if(!item||item.task!=='revise'||resultStale.value||props.disabled||busy.value)return
 if(!props.applyEdit({...item.target,replacement:item.response.text})){message.value='当前源码或权限已变化，未应用建议。';return}
 suggestion.value=null;approved.value=[];target.value=null;message.value=props.collaborationEpoch?'已接受修改，正在通过实时协作通道同步；请留意服务器确认状态。':'已接受修改，可使用编辑器撤销；保存沿用现有版本校验。'
}
</script>

<style scoped>
.paper-ai{display:grid;gap:9px;min-width:0;font-size:12px;line-height:1.5}
.paper-ai p{margin:0;color:var(--a-color-text-secondary,#64748b)}
.paper-ai label,.paper-ai__settings,.paper-ai__context,.paper-ai__result{display:grid;gap:5px;min-width:0}
.paper-ai__settings,.paper-ai__context,.paper-ai__result,.paper-ai__notice{border:1px solid var(--a-color-border-soft,#ddd);border-radius:6px;padding:9px}
.paper-ai summary{cursor:pointer;font-weight:600}
.paper-ai input:not([type=checkbox]),.paper-ai textarea,.paper-ai select{box-sizing:border-box;width:100%;min-width:0;border:1px solid var(--a-color-border-soft,#ddd);border-radius:4px;background:var(--a-color-bg,#fff);color:inherit;padding:6px;font:inherit}
.paper-ai textarea{resize:vertical}
.paper-ai__row{display:flex;align-items:center;flex-wrap:wrap;gap:6px}
.paper-ai__row>button{font-size:12px}
.paper-ai label.paper-ai__check{display:flex;align-items:flex-start;gap:6px;overflow-wrap:anywhere}
.paper-ai__check input{flex-shrink:0;margin-top:3px}
.paper-ai__consent{padding:7px;background:var(--a-color-bg-soft,#f1f3f5);border-radius:4px}
.paper-ai pre{font:12px/1.6 monospace;margin:4px 0 0;max-height:210px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:8px;background:var(--a-color-bg-soft,#f1f3f5);border-radius:4px}
.paper-ai__diff{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:8px;min-width:0}
.paper-ai__diff>div{min-width:0}
.paper-ai small{color:var(--a-color-text-secondary,#64748b)}
</style>
