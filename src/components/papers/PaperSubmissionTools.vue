<template>
 <section class="paper-submission" aria-label="投稿前检查">
  <p>基于服务器当前已保存版本检查引用、标签、文件路径和占位符，并核对实际加载的 PDF 页数。静态分析不理解任意 LaTeX 宏，不能替代官方投稿规则或人工匿名审阅。</p>
  <PCheckbox v-model="anonymous">按匿名投稿检查可能的作者信息和致谢</PCheckbox>
  <PInput v-model.trim="limit" label="PDF 总页数上限（可选）" inputmode="numeric" maxlength="4" placeholder="按目标会议规则自行填写" />
  <small>总页数包含参考文献和附录，若会议只限制正文，需要人工核对。不会擅自套用会议页数规则。</small>
  <PButton type="button" size="sm" :disabled="disabled||loading||!revision" @click="run">检查当前保存版本</PButton>
  <p v-if="disabled">请先完成当前保存、编译或文件操作。</p>
  <p v-if="message" role="status">{{message}}</p>
  <template v-if="report&&report.revision===revision&&report.fence===manifestFence&&!disabled">
   <strong>项目 v{{report.revision}} · {{report.texCount}} 个 TeX 文件 · {{report.bibCount}} 条 BibTeX 记录</strong>
   <p v-if="currentPDF">已加载当前版本编译 PDF：{{currentPDF.pages}} 页<span v-if="pageLimit"> · {{currentPDF.pages<=pageLimit?'未超过设置的总页数上限':'超过设置的总页数上限'}}</span></p>
   <p v-else>尚未加载与当前版本匹配的成功编译 PDF，无法确认页数。</p>
   <p v-if="!report.findings.length">静态规则未发现问题；仍需检查 PDF、官方格式、匿名性及文献真实性。</p>
   <p v-else>发现 {{report.findings.length}}{{report.truncated?' +':''}} 项需核对的问题：</p>
   <div v-for="(finding,index) in report.findings" :key="index" class="paper-submission__finding">
    <strong>{{finding.kind==='warning'?'警告':'人工核对'}} · {{finding.path}}{{finding.line?':'+finding.line:''}}</strong>
    <span>{{finding.message}}</span>
   </div>
   <PButton v-if="report.findings.length" type="button" size="sm" variant="secondary" @click="copyReport">复制检查报告</PButton>
  </template>
  <p v-else-if="report">项目版本已变化，旧检查结果不再有效。</p>
 </section>
</template>
<script setup lang="ts">
import {computed,ref,shallowRef,watch,onBeforeUnmount} from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PCheckbox from '@/components/ui/PCheckbox.vue'
import {getPaperFile,getPaperProject,type PaperFile,type PaperCompileJob} from '@/api/papers'
import {readProjectText,projectFileFence} from './projectRead'
import {checkSubmissionSource} from './submissionChecks'
type PDFMeta={jobId:string;revision:number;pages:number}
const props=defineProps<{projectId:string;accountId:string;revision:number;files:PaperFile[];disabled:boolean;compileJob?:PaperCompileJob|null;pdf?:PDFMeta|null}>()
const anonymous=ref(true),limit=ref(''),message=ref(''),loading=ref(false)
const report=shallowRef<(ReturnType<typeof checkSubmissionSource>&{revision:number;fence:string;anonymous:boolean})|null>(null)
const manifestFence=computed(()=>projectFileFence(props.files))
const currentPDF=computed(()=>props.compileJob?.status==='succeeded'&&props.compileJob.pdf_available&&props.compileJob.source_revision===props.revision&&props.compileJob.id===props.pdf?.jobId&&props.pdf.revision===props.revision&&props.pdf.pages>0?props.pdf:null)
const pageLimit=computed(()=>/^\d{1,4}$/.test(limit.value)&&Number(limit.value)>0?Number(limit.value):null)
let serial=0,disposed=false
const scope=()=>props.accountId+':'+props.projectId
async function run(){
 if(disposed||props.disabled||loading.value||!props.revision)return
 const n=++serial,initial=scope(),pid=props.projectId,revision=props.revision,fence=manifestFence.value,mode=anonymous.value
 const valid=()=>!disposed&&n===serial&&scope()===initial&&revision===props.revision&&fence===manifestFence.value&&mode===anonymous.value&&!props.disabled
 loading.value=true;report.value=null;message.value=''
 try{
  const before=await getPaperProject(pid)
  if(!valid()||before.id!==pid||before.head_revision!==revision)throw Error('Project changed')
  const text=await readProjectText([...props.files],revision,id=>getPaperFile(pid,id),valid)
  const after=await getPaperProject(pid)
  if(!valid()||after.id!==pid||after.head_revision!==revision)throw Error('Project changed')
  report.value={...checkSubmissionSource(text,props.files,mode),revision,fence,anonymous:mode}
  message.value='检查完成，未修改任何文件。'
 }catch{if(!disposed&&n===serial&&scope()===initial)message.value='检查未完成：项目可能已变化、权限不足、读取失败或源码超过 4 MiB。'}
 finally{if(!disposed&&n===serial&&scope()===initial)loading.value=false}
}
async function copyReport(){
 const value=report.value
 if(!value||value.revision!==props.revision||value.fence!==manifestFence.value||props.disabled)return
 const initial=scope()
 const rows=['Papers 投稿检查 · v'+value.revision,...(currentPDF.value?['当前 PDF '+currentPDF.value.pages+' 页']:['未核验当前 PDF 页数']),...value.findings.map(f=>f.path+(f.line?':'+f.line:'')+' '+f.message),'静态检查仅供人工核对，不代表官方合规。']
 try{await navigator.clipboard.writeText(rows.join('\n'));if(!disposed&&scope()===initial)message.value='已复制检查报告。'}catch{if(!disposed&&scope()===initial)message.value='无法写入剪贴板，请在页面中复制。'}
}
watch([scope,anonymous],()=>{serial++;loading.value=false;report.value=null;message.value=''})
onBeforeUnmount(()=>{disposed=true;serial++;report.value=null})
</script>
<style scoped>
.paper-submission{display:grid;gap:7px;min-width:0}
.paper-submission p,.paper-submission small{margin:0;overflow-wrap:anywhere}
.paper-submission__finding{display:grid;gap:3px;border-left:2px solid var(--a-color-border-soft);padding:5px 8px;overflow-wrap:anywhere}
</style>
