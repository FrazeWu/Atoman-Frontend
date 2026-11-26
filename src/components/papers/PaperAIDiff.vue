<template>
 <section class="paper-ai-diff" aria-label="AI 修改差异">
  <div class="paper-ai-diff__legend"><span>− 原文中的差异范围</span><span>+ 修改后的差异范围</span></div>
  <div class="paper-ai-diff__columns">
   <div><strong>原文</strong><pre><span>{{ parts.prefix }}</span><del v-if="parts.removed">{{ parts.removed }}</del><span>{{ parts.suffix }}</span><span v-if="!before">（空）</span></pre></div>
   <div><strong>建议替换为</strong><pre><span>{{ parts.prefix }}</span><ins v-if="parts.added">{{ parts.added }}</ins><span>{{ parts.suffix }}</span><span v-if="!after">（删除该片段）</span></pre></div>
  </div>
 </section>
</template>
<script setup lang="ts">
import {computed} from 'vue'
import {contiguousAIDiff} from './aiWorkbench'
const props=defineProps<{before:string;after:string}>()
const parts=computed(()=>contiguousAIDiff(props.before,props.after))
</script>
<style scoped>
.paper-ai-diff{min-width:0;display:grid;gap:6px}
.paper-ai-diff__legend{display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--a-color-text-secondary,#64748b)}
.paper-ai-diff__columns{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:8px;min-width:0}
.paper-ai-diff__columns>div{min-width:0}
.paper-ai-diff pre{font:12px/1.65 monospace;margin:4px 0 0;max-height:360px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:8px;background:var(--a-color-bg-soft,#f1f3f5);border:1px solid var(--a-color-border-soft,#ddd);border-radius:4px}
.paper-ai-diff del{background:#fee2e2;color:#991b1b;text-decoration:line-through}
.paper-ai-diff ins{background:#dcfce7;color:#166534;text-decoration:none;border-bottom:1px solid #16a34a}
</style>
