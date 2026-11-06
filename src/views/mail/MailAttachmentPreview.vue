<template>
  <PModal :show="true" :title="attachment.name || '附件预览'" size="lg" @close="emit('close')">
    <div class="mail-attachment-preview" data-testid="mail-attachment-preview">
      <p v-if="loading" role="status">正在安全读取附件…</p>
      <p v-else-if="error" role="alert">{{ error }}</p>
      <img v-else-if="kind === 'image' && objectUrl" class="mail-attachment-preview__image" :src="objectUrl" alt="邮件附件图片预览" />
      <div v-else-if="kind === 'pdf'" class="mail-attachment-preview__pdf">
        <canvas ref="canvas" aria-label="PDF 页面预览" />
        <div v-if="pageTotal > 1" class="mail-attachment-preview__pager">
          <PButton variant="secondary" size="sm" :disabled="page <= 1 || loadingPage" @click="page--; void renderPage()">上一页</PButton>
          <span>第 {{ page }} / {{ pageTotal }} 页</span>
          <PButton variant="secondary" size="sm" :disabled="page >= pageTotal || loadingPage" @click="page++; void renderPage()">下一页</PButton>
        </div>
      </div>
      <PEmpty v-else compact title="不支持在线预览" description="仅允许预览静态图片和 PDF，其他附件请下载后用可信应用查看。" />
      <div class="mail-attachment-preview__footer">
        <span>{{ fileSize(attachment.size) }}</span>
        <PButton variant="secondary" size="sm" :disabled="downloading || !attachment.partId" @click="download">下载附件</PButton>
        <PButton size="sm" variant="ghost" @click="emit('close')">关闭</PButton>
      </div>
    </div>
  </PModal>
</template>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import PModal from '@/components/ui/PModal.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import { fetchMailAttachmentBlob, downloadMailAttachment } from '@/api/mailClient'
import { loadPdfEngine } from '@/utils/bookReaderEngines'
import { fileSize } from './mail-helpers'
import { sniffMailAttachmentType } from './mail-attachment-kind'
import type { MailAttachmentInfo } from '@/api/mail'

const props=defineProps<{messageId:string;attachment:MailAttachmentInfo}>()
const emit=defineEmits<{close:[]}>()
const loading=ref(true),loadingPage=ref(false),downloading=ref(false),error=ref('')
const kind=ref<'image'|'pdf'|'other'>('other')
const objectUrl=ref(''), canvas=ref<HTMLCanvasElement|null>(null)
const page=ref(1),pageTotal=ref(0)
let disposed=false, renderGeneration=0
let pdfTask: { destroy:()=>void; promise:Promise<unknown> }|undefined
let doc: Awaited<ReturnType<Awaited<ReturnType<typeof loadPdfEngine>>['getDocument']>['promise']>|undefined
let renderTask:{cancel:()=>void;promise:Promise<void>}|undefined

async function load(){
 try{
  if(!props.attachment.partId || props.attachment.size>10*1024*1024)throw new Error('附件不支持在线预览，请下载查看。')
  const blob=await fetchMailAttachmentBlob(props.messageId,props.attachment.partId)
  if(disposed)return
  if(blob.size>10*1024*1024)throw new Error('附件体积超过预览限制，请下载查看。')
  const magic=sniffMailAttachmentType(new Uint8Array(await blob.slice(0,16).arrayBuffer()))
  if(magic==='other'){kind.value='other';return}
  if(magic!=='pdf'){
   kind.value='image'
   const types:{[key:string]:string}={png:'image/png',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp'}
   objectUrl.value=URL.createObjectURL(new Blob([blob],{type:types[magic]}))
   return
  }
  const {getDocument}=await loadPdfEngine()
  if(disposed)return
  kind.value='pdf'
  const task=getDocument({data:await blob.arrayBuffer(),disableAutoFetch:true})
  pdfTask=task
  doc=await task.promise
  if(disposed)return
  pageTotal.value=Math.min(doc.numPages,100)
 }catch(e){if(!disposed){kind.value='other';error.value=e instanceof Error ? e.message:'附件预览失败，请尝试下载。'}}
 finally{
  loading.value=false
  if(!disposed && kind.value==='pdf'){await nextTick();await renderPage()}
 }
}
async function renderPage(){
 if(!doc || disposed || !canvas.value)return
 const generation=++renderGeneration
 loadingPage.value=true
 try{
  renderTask?.cancel()
  await renderTask?.promise.catch(()=>undefined)
  if(disposed || generation!==renderGeneration)return
  const current=await doc.getPage(page.value)
  if(disposed || generation!==renderGeneration)return
  const width=canvas.value.parentElement?.clientWidth || 690
  const view=current.getViewport({scale:1})
  const scale=Math.max(.3,Math.min(1.5,(width-25)/view.width,Math.sqrt(7000000/(view.width*view.height))))
  const viewport=current.getViewport({scale})
  const ctx=canvas.value.getContext('2d')
  if(!ctx)return
  canvas.value.width=Math.ceil(viewport.width);canvas.value.height=Math.ceil(viewport.height)
  renderTask=current.render({canvas:canvas.value,canvasContext:ctx,viewport})
  await renderTask.promise
 }catch{if(!disposed && generation===renderGeneration)error.value='PDF 页面无法显示，请尝试下载附件。'}
 finally{if(generation===renderGeneration)loadingPage.value=false}
}
async function download(){
 if(!props.attachment.partId)return
 downloading.value=true
 try{await downloadMailAttachment(props.messageId,props.attachment.partId,props.attachment.name||'attachment')}
 catch{error.value='附件下载失败，请重试。'}
 finally{downloading.value=false}
}
onMounted(()=>void load())
onBeforeUnmount(()=>{disposed=true;renderGeneration++;renderTask?.cancel();void pdfTask?.destroy();if(objectUrl.value)URL.revokeObjectURL(objectUrl.value)})
</script>
<style scoped>
.mail-attachment-preview {display:grid;gap:15px;min-height:120px;}
.mail-attachment-preview__image {display:block;max-width:100%;max-height:68dvh;object-fit:contain;margin:0 auto;}
.mail-attachment-preview__pdf {display:grid;justify-items:center;gap:15px;max-height:70dvh;overflow:auto;}
.mail-attachment-preview__pdf canvas {display:block;max-width:100%;height:auto;background:#fff;}
.mail-attachment-preview__pager {display:flex;gap:15px;align-items:center;justify-content:center;font-size:13px;}
.mail-attachment-preview__footer {display:flex;align-items:center;justify-content:flex-end;gap:10px;padding-top:15px;border-top:1px solid var(--a-color-border-soft);}
.mail-attachment-preview__footer span {flex:1;font-size:12px;color:var(--a-color-muted);}
</style>
