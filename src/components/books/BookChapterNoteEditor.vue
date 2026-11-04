<template>
  <PSheet :show="true" title="独立章节笔记" mode="full" teleport-mobile @close="requestClose">
    <form class="chapter-note-editor" @submit.prevent="save">
      <p class="chapter-note-editor__hint">只保存在你的私人笔记库中，不会自动公开。笔记关联当前具体电子书文件。</p>
      <p class="chapter-note-editor__location">{{ locationLabel }}</p>
      <label>笔记标题<input v-model="title" type="text" maxlength="255" :disabled="busy || frozen" placeholder="这段阅读的主题（可选）" /></label>
      <label>笔记正文<textarea v-model="body" rows="9" maxlength="200000" :readonly="busy || frozen" placeholder="写下对这一章或当前位置的想法…" /></label>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="conflict" class="chapter-note-editor__hint">其他设备已修改这条笔记。当前输入仍保留，请复制后重新加载，不会覆盖云端版本。</p>
      <div class="chapter-note-editor__actions">
        <PButton type="submit" :disabled="busy || conflict || frozen || (!title.trim() && !body.trim())">{{ busy ? '正在保存…' : frozen ? '等待原请求确认' : '保存章节笔记' }}</PButton>
        <PButton type="button" variant="ghost" :disabled="busy" @click="requestClose">取消</PButton>
      </div>
    </form>
    <PConfirm :show="confirmClose" title="放弃未保存的笔记？" message="关闭后将丢弃当前尚未保存的更改。" confirm-text="放弃编辑" @confirm="finishClose(true)" @cancel="finishClose(false)" />
  </PSheet>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { PrivateNote } from '@/api/bookPrivate'
import PButton from '@/components/ui/PButton.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PConfirm from '@/components/ui/PConfirm.vue'

const props = defineProps<{ draft: PrivateNote; busy: boolean; frozen: boolean; conflict: boolean; error: string }>()
const emit = defineEmits<{ save: [value: { title: string; body: string }]; close: [] }>()
const title = ref(props.draft.title)
const body = ref(props.draft.body)
const confirmClose = ref(false)
let closeResult: ((value: boolean) => void) | undefined
let closing: Promise<boolean> | undefined
const anchor = props.draft.chapter_anchor
const locationLabel = anchor?.chapter_title || (anchor?.format === 'pdf' ? `第 ${anchor.pdf_page} 页` : anchor?.format === 'epub' ? 'EPUB 具体位置' : anchor?.format === 'txt' ? `文本偏移 ${anchor.txt_offset}` : '无精确章节定位')
function save() { if (title.value.trim() || body.value.trim()) emit('save', { title: title.value.trim(), body: body.value }) }
function dirty() { return props.frozen || title.value !== props.draft.title || body.value !== props.draft.body }
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
.chapter-note-editor { display:grid; gap:1rem; padding:1.5rem; max-width:43rem; margin-inline:auto; }
.chapter-note-editor label { display:grid; gap:.45rem; }
.chapter-note-editor input,.chapter-note-editor textarea { width:100%; border:1px solid var(--a-color-border-soft); background:var(--a-color-bg); color:var(--a-color-fg); border-radius:.5rem; padding:.8rem; }
.chapter-note-editor__hint { font-size:.85rem; color:var(--a-color-text-secondary); }
.chapter-note-editor__location { padding:.65rem .8rem; background:var(--a-color-surface-secondary,transparent); border-radius:.5rem; }
.chapter-note-editor__actions { display:flex; gap:.8rem; flex-wrap:wrap; }
</style>
