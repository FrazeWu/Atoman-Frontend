<template>
  <div class="paper-figures">
    <div class="paper-figures__top">
      <span>{{ figures.length }} 个插图资源</span>
      <input ref="picker" type="file" multiple accept=".png,.jpg,.jpeg,.pdf" hidden :disabled="disabled" @change="pickFiles" />
      <PButton type="button" size="sm" variant="secondary" :disabled="disabled" @click="picker?.click()">上传插图</PButton>
    </div>
    <p v-if="!figures.length">上传 PNG、JPEG 或 PDF 插图后即可生成 LaTeX 插图代码。也可以拖入左侧文件栏。</p>
    <template v-else>
      <label>插图文件
        <select v-model="selectedId" aria-label="插图文件">
          <option v-for="file in figures" :key="file.id" :value="file.id">{{ file.path }}</option>
        </select>
      </label>
      <p v-if="checking" role="status">正在读取图片资源…</p>
      <p v-if="assetError" role="alert" class="paper-figures__error">{{ assetError }}</p>
      <div v-if="asset" class="paper-figures__asset">
        <span>{{ asset.path }} · {{ assetSize }}</span>
        <button type="button" class="paper-figures__link" :aria-expanded="previewOpen" @click="previewOpen=!previewOpen">{{ previewOpen?'收起预览':'预览资源' }}</button>
      </div>
      <div v-if="asset && previewOpen" class="paper-figures__preview">
        <PaperAssetPreview :key="asset.id+':'+asset.revision" :file="asset" />
      </div>
      <div class="paper-figures__fields">
        <label>图片宽度（%）
          <input v-model.number="width" type="number" min="10" max="100" step="5" aria-label="图片宽度百分比" />
        </label>
        <label>浮动位置
          <select v-model="placement" aria-label="插图浮动位置">
            <option v-for="option in figurePlacementOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
      </div>
      <label class="paper-figures__check"><input v-model="wide" type="checkbox" /> 双栏通栏图（figure*）</label>
      <label>图注
        <input v-model="caption" maxlength="400" placeholder="输入图片说明" aria-label="图片图注" />
      </label>
      <label>引用标签
        <input v-model="label" maxlength="100" placeholder="fig:architecture" aria-label="图片引用标签" />
      </label>
      <p v-if="codeError" role="alert" class="paper-figures__error">{{ codeError }}</p>
      <label v-if="code">生成的 LaTeX 代码
        <textarea readonly :value="code" rows="6" spellcheck="false" aria-label="生成的插图代码" />
      </label>
      <div class="paper-figures__actions">
        <PButton type="button" size="sm" :disabled="disabled||!canInsert||!asset||!code" @click="insert">插入到光标处</PButton>
        <PButton type="button" size="sm" variant="secondary" :disabled="!code||!asset" @click="copyCode">复制代码</PButton>
      </div>
      <p v-if="copyStatus" role="status">{{ copyStatus }}</p>
      <p v-if="!canInsert">先在源码栏打开一个 .tex 文件并定位插入位置。</p>
      <p class="paper-figures__hint">路径相对于项目根目录。中文文件名或图注请使用支持中文的编译环境。请确认导言区已加载 <code>\usepackage{graphicx}</code>；图注按普通文本转义，标签需在项目中保持唯一。</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import {computed,ref,shallowRef,watch,onBeforeUnmount} from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PaperAssetPreview from './PaperAssetPreview.vue'
import {getPaperFile,type PaperFile} from '@/api/papers'
import {figurePlacementOptions,isFigureFile,makeFigureCode,suggestedFigureLabel,type FigureInsertion,type FigurePlacement} from './figureTools'
import {paperResourceBlob} from './fileTools'

const props=defineProps<{projectId:string;files:PaperFile[];disabled:boolean;canInsert:boolean}>()
const emit=defineEmits<{upload:[files:File[]];insert:[figure:FigureInsertion]}>()
const picker=ref<HTMLInputElement|null>(null)
const figures=computed(()=>props.files.filter(isFigureFile).slice().sort((a,b)=>a.path.localeCompare(b.path)))
const selectedId=ref('')
const selected=computed(()=>figures.value.find(f=>f.id===selectedId.value))
const asset=shallowRef<PaperFile|null>(null)
const checking=ref(false),assetError=ref(''),previewOpen=ref(false),copyStatus=ref('')
const width=ref(80),placement=ref<FigurePlacement>('htbp'),wide=ref(false)
const caption=ref('Figure caption'),label=ref('')
let requestSerial=0
watch(()=>figures.value.map(f=>f.id), (ids,prior)=>{
  const added=prior?.length?ids.find(id=>!prior.includes(id)):undefined
  if(added)selectedId.value=added
  else if(!ids.includes(selectedId.value))selectedId.value=ids[0]||''
},{immediate:true})
watch(()=>[props.projectId,selected.value?.id,selected.value?.path,selected.value?.revision] as const,async ([pid,id,path,revision],previous)=>{
  const serial=++requestSerial
  asset.value=null;checking.value=false;assetError.value='';previewOpen.value=false;copyStatus.value=''
  if(!id||!path||revision===undefined)return
  if(!previous||previous[0]!==pid||previous[1]!==id||previous[2]!==path)label.value=suggestedFigureLabel(path)
  checking.value=true
  try{
    const file=await getPaperFile(pid,id)
    if(serial!==requestSerial)return
    if(file.id!==id||file.path!==path||file.revision!==revision||!isFigureFile(file))
      throw new Error('资源版本已变化，请重新打开插图面板。')
    if(!paperResourceBlob(file))throw new Error('此文件不是可识别的 PNG、JPEG 或 PDF 资源。')
    asset.value=file
  }catch(cause){if(serial===requestSerial)assetError.value=cause instanceof Error?cause.message:'资源读取失败，请重试。'}
  finally{if(serial===requestSerial)checking.value=false}
},{immediate:true})
onBeforeUnmount(()=>{requestSerial++})

const generated=computed(()=>{
  if(!selected.value)return {code:'',error:''}
  try{return {code:makeFigureCode({path:selected.value.path,width:width.value,placement:placement.value,caption:caption.value,label:label.value,wide:wide.value}),error:''}}
  catch(cause){return {code:'',error:cause instanceof Error?cause.message:'插图参数无效。'}}
})
const code=computed(()=>generated.value.code)
const codeError=computed(()=>generated.value.error)
const assetSize=computed(()=>asset.value?Math.round(paperResourceBlob(asset.value)!.size/1024*10)/10+' KiB':'')
function pickFiles(event:Event){
  const input=event.target as HTMLInputElement
  const picked=Array.from(input.files||[]);input.value=''
  if(picked.length&&!props.disabled)emit('upload',picked)
}
function insert(){
  const file=asset.value
  if(props.disabled||!props.canInsert||!file||!code.value||selected.value?.id!==file.id||selected.value?.revision!==file.revision||selected.value?.path!==file.path)return
  emit('insert',{id:file.id,revision:file.revision,path:file.path,code:code.value})
}
async function copyCode(){
  if(!code.value||!asset.value)return
  try{await navigator.clipboard.writeText(code.value);copyStatus.value='已复制插图代码。'}
  catch{copyStatus.value='无法访问剪贴板，请手动选中上方代码复制。'}
}
</script>
<style scoped>
.paper-figures{display:grid;gap:7px;min-width:0}
.paper-figures__top,.paper-figures__actions,.paper-figures__asset{display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-width:0}
.paper-figures__top,.paper-figures__asset{justify-content:space-between}
.paper-figures label{display:grid;gap:4px;min-width:0}
.paper-figures input:not([type=checkbox]),.paper-figures select,.paper-figures textarea{width:100%;box-sizing:border-box;min-width:0;border:1px solid var(--a-color-border-soft,#ddd);border-radius:4px;padding:5px;background:var(--a-color-bg,#fff);color:inherit;font:inherit}
.paper-figures textarea{font-family:'SFMono-Regular',Consolas,monospace;resize:vertical;min-height:80px;white-space:pre;overflow:auto}
.paper-figures__fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px}
.paper-figures .paper-figures__check{display:flex;align-items:center;gap:4px}
.paper-figures__preview{display:flex;flex-direction:column;min-height:140px;height:200px;overflow:hidden;border:1px solid var(--a-color-border-soft,#ddd);border-radius:4px}
.paper-figures__asset span,.paper-figures__hint{color:var(--a-color-text-secondary,#64748b);overflow-wrap:anywhere}
.paper-figures__link{background:transparent;border:1px solid var(--a-color-border-soft,#ddd);border-radius:4px;color:inherit;font:inherit;padding:4px 6px;cursor:pointer}
.paper-figures__error{color:var(--a-color-danger,#b42318)}
.paper-figures p{margin:0;overflow-wrap:anywhere}
</style>
