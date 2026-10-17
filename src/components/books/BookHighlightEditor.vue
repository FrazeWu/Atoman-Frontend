<template>
  <PSheet :show="true" title="划线与批注" mode="full" teleport-mobile @close="requestClose">
    <form class="highlight-editor" @submit.prevent="$emit('save', { color, style, note })">
      <p>仅本人可见 · 绑定当前文件版本</p>
      <blockquote>{{ draft.quote }}</blockquote>
      <PButton v-if="allowDiscussion" type="button" variant="secondary" :disabled="busy" @click="$emit('discuss')">公开讨论这段正文（不公开私人批注）</PButton>
      <fieldset :disabled="busy || frozen">
        <legend>高亮颜色</legend>
        <label v-for="option in colors" :key="option.value"><input v-model="color" type="radio" name="highlight-color" :value="option.value" />{{ option.label }}</label>
      </fieldset>
      <label>划线样式<select v-model="style" :disabled="busy || frozen"><option value="highlight">高亮</option><option value="underline">下划线</option></select></label>
      <label>我的批注<textarea v-model="note" :readonly="busy || frozen" rows="6" maxlength="10000" placeholder="可选：写下你的想法" /></label>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="conflict">云端已发生变化，当前输入仍保留在这里。请复制需要保留的内容，再关闭编辑并重新载入标记。</p>
      <div class="highlight-editor__actions">
        <PButton type="submit" :disabled="busy || conflict">{{ busy ? '正在保存…' : frozen ? '重试原操作' : '保存划线与批注' }}</PButton>
        <PButton v-if="draft.version > 0" type="button" variant="danger" :disabled="busy || frozen" @click="$emit('delete')">删除划线</PButton>
        <PButton type="button" variant="ghost" :disabled="busy" @click="requestClose">取消</PButton>
      </div>
    </form>
    <PConfirm :show="confirmClose" title="放弃未保存的批注？" message="当前输入尚未确认保存到云端。关闭后将丢弃编辑内容。" confirm-text="放弃编辑" @confirm="finishClose(true)" @cancel="finishClose(false)" />
  </PSheet>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import PSheet from '@/components/ui/PSheet.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PButton from '@/components/ui/PButton.vue'
import type { ReadingAnchor } from '@/api/bookReading'

export interface HighlightDraft { id: string; version: number; anchor: ReadingAnchor; quote: string; note: string; color: string; style: string }
const props = defineProps<{ draft: HighlightDraft; busy: boolean; frozen: boolean; conflict: boolean; error: string; allowDiscussion?: boolean }>()
const emit = defineEmits<{ save: [value: { color: string; style: string; note: string }]; delete: []; close: []; discuss: [] }>()
const color = ref(props.draft.color)
const style = ref(props.draft.style)
const note = ref(props.draft.note)
const colors = [{ value: 'yellow', label: '黄色' }, { value: 'green', label: '绿色' }, { value: 'blue', label: '蓝色' }, { value: 'pink', label: '粉色' }]
const confirmClose = ref(false)
let closeResult: ((value: boolean) => void) | undefined
let closing: Promise<boolean> | undefined
function dirty() { return props.frozen || note.value !== props.draft.note || color.value !== props.draft.color || style.value !== props.draft.style }
function requestClose(): Promise<boolean> {
  if (props.busy) return Promise.resolve(false)
  if (!dirty()) { emit('close'); return Promise.resolve(true) }
  if (closing) return closing
  confirmClose.value = true
  closing = new Promise(resolve => { closeResult = resolve })
  return closing
}
function finishClose(confirmed: boolean) {
  confirmClose.value = false
  closeResult?.(confirmed)
  closeResult = undefined
  closing = undefined
  if (confirmed) emit('close')
}
function beforeUnload(event: BeforeUnloadEvent) { if (dirty() || props.busy) { event.preventDefault(); event.returnValue = '' } }
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => { window.removeEventListener('beforeunload', beforeUnload); closeResult?.(false) })
defineExpose({ requestClose })
</script>

<style scoped>
.highlight-editor { display: grid; gap: 1.25rem; max-width: 42rem; margin-inline: auto; padding: 1.5rem; }
.highlight-editor blockquote { white-space: pre-wrap; overflow-wrap: anywhere; border-left: 3px solid var(--a-color-border-soft); padding-left: 1rem; }
.highlight-editor label { display: grid; gap: .5rem; }
.highlight-editor fieldset { display: flex; flex-wrap: wrap; gap: 1rem; }
.highlight-editor fieldset label { display: flex; align-items: center; min-height: 44px; padding-inline: .5rem; }
.highlight-editor textarea, .highlight-editor select { width: 100%; padding: .75rem; border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); color: var(--a-color-fg); }
.highlight-editor__actions { display: flex; flex-wrap: wrap; gap: .75rem; }
</style>
