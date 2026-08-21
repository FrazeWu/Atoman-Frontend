<template>
  <PEditorRuntime
    ref="runtimeRef"
    v-bind="props"
    @update:modelValue="emit('update:modelValue', $event)"
    @active-heading-change="emit('active-heading-change', $event)"
    @mode-change="emit('mode-change', $event)"
    @update:syncScroll="emit('update:syncScroll', $event)"
    @update:line-numbers="emit('update:lineNumbers', $event)"
    @collab-ready="emit('collab-ready', $event)"
  />
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import type { ResourceReferenceLabels } from './editor/resourceReferenceExtension'
import type { PostEditorCommand } from '@/components/blog/postEditorCommands'

interface Props {
  modelValue?: string
  mode: 'normal' | 'split'
  placeholder?: string
  noBorder?: boolean
  showModeToggle?: boolean
  showSyncScrollToggle?: boolean
  syncScroll?: boolean
  lineNumbers?: boolean
  showWhitespace?: boolean
  livePreview?: boolean
  showToolbar?: boolean
  enableImageUpload?: boolean
  enableMentions?: boolean
  showReferenceTrigger?: boolean
  referenceAutocompleteScope?: 'global' | 'debate'
  enableEmbeds?: boolean
  enableCollab?: boolean
  collabRoomId?: string
  protectFirstLine?: boolean
  renderingLevel?: 'full' | 'comment'
  enableResourceReferences?: boolean
  resourceReferenceLabels?: ResourceReferenceLabels
  editorAriaLabel?: string
}

type PEditorExposed = {
  scrollToHeadingLine: (targetLine: number) => void
  replaceDocument: (markdown: string) => void
  sv_wrap: (before: string, after: string, placeholder: string) => void
  sv_wrapLinePrefix: (prefix: string, placeholder: string) => void
  sv_insertLink: () => void
  sv_insertTable: () => void
  sv_insertHr: () => void
  sv_insertCodeBlock: () => void
  sv_undo: () => void
  sv_redo: () => void
  triggerImageUpload: () => void
  executeCommand: (command: PostEditorCommand) => void
}

const props = withDefaults(defineProps<Props>(), {
  syncScroll: true,
  lineNumbers: undefined,
  livePreview: true,
  showToolbar: true,
  enableImageUpload: true,
  showReferenceTrigger: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'active-heading-change': [line: number | null]
  'mode-change': [value: 'normal' | 'split']
  'update:syncScroll': [value: boolean]
  'update:lineNumbers': [value: boolean]
  'collab-ready': [value: string]
}>()

const PEditorRuntime = defineAsyncComponent({
  loader: () => import('./PEditorRuntime.vue'),
  suspensible: false,
})

const runtimeRef = ref<PEditorExposed | null>(null)

function scrollToHeadingLine(targetLine: number) {
  runtimeRef.value?.scrollToHeadingLine(targetLine)
}

function replaceDocument(markdown: string) {
  runtimeRef.value?.replaceDocument(markdown)
}

function sv_wrap(before: string, after: string, placeholder: string) {
  runtimeRef.value?.sv_wrap(before, after, placeholder)
}

function sv_wrapLinePrefix(prefix: string, placeholder: string) {
  runtimeRef.value?.sv_wrapLinePrefix(prefix, placeholder)
}

function sv_insertLink() {
  runtimeRef.value?.sv_insertLink()
}

function sv_insertTable() {
  runtimeRef.value?.sv_insertTable()
}

function sv_insertHr() {
  runtimeRef.value?.sv_insertHr()
}

function sv_insertCodeBlock() {
  runtimeRef.value?.sv_insertCodeBlock()
}

function sv_undo() {
  runtimeRef.value?.sv_undo()
}

function sv_redo() {
  runtimeRef.value?.sv_redo()
}

function triggerImageUpload() {
  runtimeRef.value?.triggerImageUpload()
}

function executeCommand(command: PostEditorCommand) {
  runtimeRef.value?.executeCommand(command)
}

defineExpose({
  scrollToHeadingLine,
  replaceDocument,
  sv_wrap,
  sv_wrapLinePrefix,
  sv_insertLink,
  sv_insertTable,
  sv_insertHr,
  sv_insertCodeBlock,
  sv_undo,
  sv_redo,
  triggerImageUpload,
  executeCommand,
})
</script>
