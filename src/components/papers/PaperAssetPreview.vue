<template>
 <section class="paper-asset">
  <p v-if="!blob" role="alert">此资源不是可识别的 PNG、JPEG 或 PDF 文件，仍会随项目导出。</p>
  <PaperPDFPreview v-else-if="blob.type==='application/pdf'" :project-id="''" :job-id="file.id" :revision="file.revision" :asset-blob="blob" :asset-name="file.path.split('/').pop()" />
  <div v-else class="paper-asset__image">
   <img v-if="url" :src="url" :alt="file.path" />
   <PButton size="sm" variant="secondary" type="button" @click="download">下载原图</PButton>
  </div>
 </section>
</template>
<script setup lang="ts">
import PButton from '@/components/ui/PButton.vue'
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import type {PaperFile} from '@/api/papers'
import PaperPDFPreview from './PaperPDFPreview.vue'
import {paperResourceBlob} from './fileTools'
const props=defineProps<{file:PaperFile}>()
const blob=computed(()=>paperResourceBlob(props.file))
const url=ref('')
watch(blob,b=>{if(url.value)URL.revokeObjectURL(url.value);url.value=b&&b.type.startsWith('image/')?URL.createObjectURL(b):''},{immediate:true})
function download(){if(!url.value)return;const a=document.createElement('a');a.href=url.value;a.download=props.file.path.split('/').pop()||'image';a.click()}
onBeforeUnmount(()=>{if(url.value)URL.revokeObjectURL(url.value)})
</script>
<style scoped>
.paper-asset{display:flex;flex:1;min-height:0;min-width:0;overflow:auto;flex-direction:column;padding:8px}
.paper-asset__image{display:flex;flex-direction:column;align-items:center;gap:12px;min-height:0}
.paper-asset img{display:block;max-width:100%;max-height:80%;object-fit:contain}
.paper-asset button{padding:6px 10px;border:1px solid var(--a-color-border-soft,#ccc);border-radius:4px;background:transparent;color:inherit}
</style>
