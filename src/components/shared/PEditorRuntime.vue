<template>
  <div
    class="p-editor"
    :class="[noBorder ? 'no-border' : null, 'mode-' + effectiveMode]"
    data-testid="markdown-editor"
    :data-editor-mode="effectiveMode"
    :data-live-preview="livePreview"
    @keydown="onContainerKeydown"
  >
    <div v-if="collabPeers.length > 0" class="p-editor-presence">
      <span class="p-editor-label">协作中</span>
      <div class="presence-avatars">
        <div
          v-for="peer in collabPeers"
          :key="peer.clientId"
          class="presence-dot"
          :style="{ background: peer.color }"
          :title="peer.name"
        >{{ peer.name.charAt(0).toUpperCase() }}</div>
      </div>
    </div>

    <div v-if="canShowModeSwitches || (enableMentions && showReferenceTrigger)" class="editor-mode-switches">
      <button
        v-if="enableMentions && showReferenceTrigger"
        type="button"
        class="editor-reference-trigger"
        title="添加引用"
        aria-label="添加引用"
        :aria-expanded="mention.visible"
        data-testid="editor-reference-trigger"
        @click="insertReference"
      >
        <AtSign :size="18" aria-hidden="true" />
      </button>

      <button
        v-if="canShowModeToggle"
        type="button"
        class="mode-switch"
        :class="{ active: effectiveMode === 'split' }"
        :aria-pressed="effectiveMode === 'split'"
        data-testid="editor-mode-toggle"
        @click="emit('mode-change', effectiveMode === 'split' ? 'normal' : 'split')"
      >
        <span class="mode-switch-label">专业模式</span>
        <span class="mode-switch-state">{{ effectiveMode === 'split' ? '开' : '关' }}</span>
      </button>

      <button
        v-if="effectiveMode === 'split' && showSyncScrollToggle"
        type="button"
        class="mode-switch"
        :class="{ active: syncScroll }"
        :aria-pressed="syncScroll"
        data-testid="editor-sync-scroll-toggle"
        @click="emit('update:syncScroll', !syncScroll)"
      >
        <span class="mode-switch-label">跟随滚动</span>
        <span class="mode-switch-state">{{ syncScroll ? '开' : '关' }}</span>
      </button>
    </div>

    <div v-if="showToolbar && effectiveMode === 'split'" class="p-editor-toolbar">
      <div class="tb-row">
        <span class="tb-row-label">格式</span>
        <button type="button" class="tb-btn" @click="sv_undo">撤销</button>
        <button type="button" class="tb-btn" @click="sv_redo">重做</button>
        <span class="tb-sep" />
        <button type="button" class="tb-btn" title="二级标题" @click="sv_wrapLinePrefix('## ', '标题')">H2</button>
        <button type="button" class="tb-btn" title="三级标题" @click="sv_wrapLinePrefix('### ', '标题')">H3</button>
        <button type="button" class="tb-btn" title="四级标题" @click="sv_wrapLinePrefix('#### ', '标题')">H4</button>
        <span class="tb-sep" />
        <button type="button" class="tb-btn tb-bold" title="粗体" @click="sv_wrap('**', '**', '粗体文字')">B</button>
        <button type="button" class="tb-btn tb-italic" title="斜体" @click="sv_wrap('*', '*', '斜体文字')">I</button>
        <button type="button" class="tb-btn tb-strike" title="删除线" @click="sv_wrap('~~', '~~', '删除线')">S</button>
        <span class="tb-sep" />
        <button type="button" class="tb-btn" title="引用" aria-label="引用" @click="sv_wrapLinePrefix('> ', '引用内容')"><Quote :size="14" /></button>
        <button type="button" class="tb-btn" title="无序列表" @click="sv_wrapLinePrefix('- ', '列表项')">• 列表</button>
        <button type="button" class="tb-btn" title="有序列表" @click="sv_wrapLinePrefix('1. ', '列表项')">1. 列表</button>
        <button type="button" class="tb-btn" :class="{ active: lineNumbersEnabled }" title="行号" @click="toggleLineNumbers">行号</button>
        <template v-if="enableEmbeds">
          <span class="tb-sep" />
          <button type="button" class="tb-btn" @click="insertEmbed('post')">文章</button>
          <button type="button" class="tb-btn" @click="insertEmbed('music')">音乐</button>
          <button type="button" class="tb-btn" @click="insertEmbed('video')">视频</button>
        </template>
      </div>
    </div>

    <input ref="imageInputRef" type="file" accept="image/*" class="tb-hidden-input" @change="handleImageUploadFile" />

    <div
      class="p-editor-body"
      :class="[effectiveMode === 'split' ? 'p-editor-sv-body' : 'p-editor-normal-body', { dragging: isDragging }]"
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <div
        class="cm-source-pane"
        :class="effectiveMode === 'split' ? 'sv-pane sv-source' : null"
      >
        <div ref="cmContainerRef" class="cm-container" data-testid="markdown-source" />
      </div>
      <div
        v-if="effectiveMode === 'split'"
        ref="previewPaneRef"
        class="sv-pane sv-preview prose-blog"
        data-testid="markdown-preview"
        v-html="svPreviewHtml"
        @scroll="onPreviewScroll"
      />
    </div>

    <PReferenceMenu
      v-if="mention.visible && (mention.loading || mention.results.length > 0)"
      :suggestions="mention.results"
      :active-index="mention.index"
      :loading="mention.loading"
      :position="{ top: mention.y, left: mention.x }"
      @hover="mention.index = $event"
      @select="applyReference"
    />

    <MediaPickerModal
      :open="pickerState.open"
      :initial-type="pickerState.type"
      :above-player="true"
      @close="pickerState.open = false"
      @select="handleMediaPickerSelect"
    />
  </div>
</template>

<script setup lang="ts">
import '@/assets/editor.css'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AtSign, Quote } from 'lucide-vue-next'
import { EditorView, highlightActiveLine, highlightActiveLineGutter, highlightWhitespace, keymap, lineNumbers, placeholder as cmPlaceholder, scrollPastEnd } from '@codemirror/view'
import { Compartment, EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import { useAuthStore } from '@/stores/auth'
import { useEditorCollaboration } from '@/composables/editor/useEditorCollaboration'
import { useEditorImageUpload } from '@/composables/editor/useEditorImageUpload'
import PReferenceMenu from '@/components/shared/PReferenceMenu.vue'
import MediaPickerModal from '@/components/shared/MediaPickerModal.vue'
import type { MediaPickerItem, MediaPickerType } from '@/types/mediaPicker'
import {
  fitReferenceMenuPosition,
  insertReferenceTrigger,
  parseReferenceTrigger,
  referenceTokenForSuggestion,
  searchReferenceSuggestions,
  searchDebateReferenceSuggestions,
  type ReferenceSuggestion,
} from '@/composables/useReferenceAutocomplete'
import {
  resourceReferenceExtension,
  updateResourceReferenceLabels,
  type ResourceReferenceLabels,
} from './editor/resourceReferenceExtension'
import { enhancePreviewCodeBlocks } from './editor/previewEnhancements'
import type { PostEditorCommand } from '@/components/blog/postEditorCommands'
import { createLivePreviewExtensions } from './pEditorLivePreview'
import * as pEditorCommands from './pEditorCommands'
import { executeEditorCommand } from './pEditorCommands'


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

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '开始输入…',
  noBorder: false,
  showModeToggle: false,
  showSyncScrollToggle: false,
  syncScroll: true,
  livePreview: true,
  showToolbar: true,
  enableImageUpload: true,
  enableMentions: false,
  showReferenceTrigger: true,
  referenceAutocompleteScope: 'global',
  enableEmbeds: false,
  enableCollab: false,
  collabRoomId: undefined,
  protectFirstLine: false,
  renderingLevel: 'full',
  enableResourceReferences: false,
  resourceReferenceLabels: () => ({}),
  editorAriaLabel: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'active-heading-change': [line: number | null]
  'mode-change': [value: 'normal' | 'split']
  'update:syncScroll': [value: boolean]
  'update:lineNumbers': [value: boolean]
  'collab-ready': [value: string]
}>()

const authStore = useAuthStore()
const { renderMarkdown, runtimeState: markdownRuntimeState } = useMarkdownRenderer()
const effectiveMode = computed<'normal' | 'split'>(() => props.mode)
const canShowModeSwitches = computed(() => (
  (!props.enableCollab && props.showModeToggle) || (effectiveMode.value === 'split' && props.showSyncScrollToggle)
))
const canShowModeToggle = computed(() => !props.enableCollab && props.showModeToggle)

const svPreviewHtml = computed(() => renderMarkdown(props.modelValue))

const cmContainerRef = ref<HTMLElement | null>(null)
const previewPaneRef = ref<HTMLElement | null>(null)
const internalLineNumbers = ref(false)
const lineNumbersEnabled = computed(() => props.lineNumbers ?? internalLineNumbers.value)
const lineNumberCompartment = new Compartment()
const livePreviewCompartment = new Compartment()
const resourceReferenceCompartment = new Compartment()
const contentAttributesCompartment = new Compartment()
let cmView: EditorView | null = null
let collabReady = false
let collabFallbackTimer: ReturnType<typeof setTimeout> | null = null
const {
  imageInputRef,
  isDragging,
  triggerImageUpload,
  handleImageUploadFile,
  onCmPaste,
  handleDropFiles,
  onDragOver,
  onDragLeave,
  onDrop,
} = useEditorImageUpload({
  enabled: () => props.enableImageUpload,
  getView: () => cmView,
})

const myName = computed(() => authStore.user?.display_name || authStore.user?.username || '匿名')
const collaboration = useEditorCollaboration({
  userName: myName,
  initialValue: () => props.modelValue,
  onReady: value => {
    collabReady = true
    if (collabFallbackTimer) {
      clearTimeout(collabFallbackTimer)
      collabFallbackTimer = null
    }
    if (cmView && cmView.state.doc.toString() !== value) {
      cmView.dispatch({
        changes: {
          from: 0,
          to: cmView.state.doc.length,
          insert: value,
        },
      })
    }
    emit('collab-ready', value)
  },
})
const collabPeers = collaboration.peers

function findActiveHeadingLine(docText: string, position: number): number | null {
  const lines = docText.split('\n')
  let offset = 0
  let active: number | null = null

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1
    const lineText = lines[index]
    const lineStart = offset
    const lineEnd = offset + lineText.length

    if (/^#{2,}\s+.+/.test(lineText) && lineStart <= position) {
      active = lineNumber
    }
    if (position <= lineEnd) break
    offset = lineEnd + 1
  }

  return active
}

function getDocOffsetByLine(targetLine: number): number {
  if (!cmView) return 0
  try {
    const line = cmView.state.doc.line(targetLine)
    return line.from
  } catch {
    return 0
  }
}

function scrollToHeadingLine(targetLine: number) {
  if (!cmView) return
  const anchor = getDocOffsetByLine(targetLine)
  cmView.dispatch({
    selection: { anchor },
    effects: EditorView.scrollIntoView(anchor, { y: 'start', yMargin: 48 }),
  })
  cmView.focus()
}

let syncingScroll = false

function onCmScroll() {
  if (!props.syncScroll || syncingScroll || effectiveMode.value !== 'split' || !cmView || !previewPaneRef.value) return
  syncingScroll = true
  const dom = cmView.scrollDOM
  const ratio = dom.scrollTop / (dom.scrollHeight - dom.clientHeight || 1)
  const preview = previewPaneRef.value
  preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight)
  requestAnimationFrame(() => { syncingScroll = false })
}

function onPreviewScroll() {
  if (!props.syncScroll || syncingScroll || effectiveMode.value !== 'split' || !cmView || !previewPaneRef.value) return
  syncingScroll = true
  const preview = previewPaneRef.value
  const ratio = preview.scrollTop / (preview.scrollHeight - preview.clientHeight || 1)
  const dom = cmView.scrollDOM
  dom.scrollTop = ratio * (dom.scrollHeight - dom.clientHeight)
  requestAnimationFrame(() => { syncingScroll = false })
}

function clearCollabFallbackTimer() {
  if (!collabFallbackTimer) return
  clearTimeout(collabFallbackTimer)
  collabFallbackTimer = null
}

function seedCollabEditorFromModel() {
  collabFallbackTimer = null
  if (
    collabReady ||
    !cmView ||
    !props.enableCollab ||
    !props.collabRoomId ||
    !props.modelValue ||
    cmView.state.doc.length > 0
  ) return

  cmView.dispatch({
    changes: { from: 0, to: 0, insert: props.modelValue },
  })
}

function scheduleCollabFallback() {
  clearCollabFallbackTimer()
  collabReady = false
  collabFallbackTimer = setTimeout(seedCollabEditorFromModel, 1500)
}

function teardownEditor() {
  if (mentionDebounce) {
    clearTimeout(mentionDebounce)
    mentionDebounce = null
  }
  clearCollabFallbackTimer()
  collaboration.stop()
  cmView?.destroy()
  cmView = null
}

function lineNumberExtensions() {
  return lineNumbersEnabled.value ? [lineNumbers(), highlightActiveLineGutter()] : []
}

function resourceReferenceExtensions() {
  return props.enableResourceReferences
    ? resourceReferenceExtension(props.resourceReferenceLabels)
    : []
}

function editorContentAttributes(): Record<string, string> {
  return props.editorAriaLabel ? { 'aria-label': props.editorAriaLabel } : {}
}

function replaceDocument(markdown: string) {
  if (props.enableCollab && collaboration.replaceDocument(markdown)) return

  if (!cmView) return

  cmView.dispatch({
    changes: {
      from: 0,
      to: cmView.state.doc.length,
      insert: markdown,
    },
  })
}

function livePreviewExtensions() {
  return createLivePreviewExtensions(renderMarkdown)
}

function initCodeMirror() {
  if (!cmContainerRef.value || cmView) return

  const bindings = [...defaultKeymap, ...historyKeymap, indentWithTab] as unknown as Parameters<typeof keymap.of>[0]

  const extensions = [
    history(),
    keymap.of(bindings),
    markdown({ codeLanguages: languages }),
    lineNumberCompartment.of(lineNumberExtensions()),
    livePreviewCompartment.of(props.livePreview ? livePreviewExtensions() : []),
    props.showWhitespace ? highlightWhitespace() : [],
    resourceReferenceCompartment.of(resourceReferenceExtensions()),
    contentAttributesCompartment.of(EditorView.contentAttributes.of(editorContentAttributes())),
    EditorView.lineWrapping,
    scrollPastEnd(),
    cmPlaceholder(props.placeholder),
    EditorView.domEventHandlers({
      scroll: () => {
        if (effectiveMode.value === 'split') onCmScroll()
      },
      paste: onCmPaste,
      drop: (e) => {
        e.preventDefault()
        handleDropFiles(e.dataTransfer?.files)
      },
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        emit('update:modelValue', update.state.doc.toString())
      }
      if (update.docChanged || update.selectionSet || update.focusChanged) {
        const docText = update.state.doc.toString()
        const head = update.state.selection.main.head
        emit('active-heading-change', findActiveHeadingLine(docText, head))
      }
      if (props.enableMentions && (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged)) {
        const pos = update.state.selection.main.head
        const doc = update.state.doc
        const line = doc.lineAt(pos)
        const textBefore = line.text.slice(0, pos - line.from)
        detectMentionFromText(textBefore, pos)
      }
    }),
    EditorView.theme({
      '&': { height: '100%', fontSize: '0.875rem' },
      '.cm-scroller': {
        fontFamily: 'inherit',
        lineHeight: '1.75',
        padding: '1.5rem 1.5rem 2rem',
        overflow: 'auto',
      },
      '.cm-content': { caretColor: 'var(--a-color-fg)' },
      '.cm-cursor': { borderLeftColor: 'var(--a-color-fg)' },
      '.cm-selectionBackground, ::selection': { backgroundColor: '#d4e0ff' },
      '.cm-focused .cm-selectionBackground': { backgroundColor: '#b3ccff' },
      '.cm-line': { padding: '0' },
      '&.cm-focused': { outline: 'none' },
    }),
  ]

  const mdHighlightStyle = props.renderingLevel === 'comment'
    ? HighlightStyle.define([
        { tag: tags.strong, fontWeight: '700' },
        { tag: tags.emphasis, fontStyle: 'italic' },
        { tag: tags.monospace, fontFamily: "'SFMono-Regular','Consolas','Liberation Mono',monospace", fontSize: '0.85em', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '3px', padding: '0.1em 0.3em' },
      ])
    : HighlightStyle.define([
        { tag: tags.heading1, fontSize: '1.6em', fontWeight: '700', lineHeight: '1.25' },
        { tag: tags.heading2, fontSize: '1.35em', fontWeight: '700', lineHeight: '1.3' },
        { tag: tags.heading3, fontSize: '1.15em', fontWeight: '600', lineHeight: '1.4' },
        { tag: tags.heading4, fontSize: '1.05em', fontWeight: '600' },
        { tag: tags.strong, fontWeight: '700' },
        { tag: tags.emphasis, fontStyle: 'italic' },
        { tag: tags.monospace, fontFamily: "'SFMono-Regular','Consolas','Liberation Mono',monospace", fontSize: '0.85em', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '3px', padding: '0.1em 0.3em' },
        { tag: tags.quote, color: '#6b7280', fontStyle: 'italic' },
        { tag: tags.link, color: '#2563eb' },
      ])
  extensions.push(syntaxHighlighting(mdHighlightStyle))
  if (props.renderingLevel !== 'comment') {
    extensions.push(highlightActiveLine())
  }

  if (props.protectFirstLine) {
    extensions.push(
      EditorState.transactionFilter.of((tr) => {
        if (!tr.docChanged) return tr
        const firstLine = tr.newDoc.line(1).text
        if (!firstLine.startsWith('# ')) return []
        return tr
      })
    )
    extensions.push(
      EditorView.baseTheme({
        '.cm-line:first-child': {
          fontSize: '1.5rem',
          lineHeight: '1.35',
          fontWeight: '700',
          paddingBottom: '0.75rem',
          display: 'block',
        },
      })
    )
  }

  if (props.enableCollab && props.collabRoomId) {
    const session = collaboration.start(props.collabRoomId)
    extensions.push(session.extension)
    cmView = new EditorView({
      state: EditorState.create({
        doc: session.document,
        extensions,
      }),
      parent: cmContainerRef.value,
    })
    scheduleCollabFallback()
    return
  }

  cmView = new EditorView({
    state: EditorState.create({
      doc: props.modelValue,
      extensions,
    }),
    parent: cmContainerRef.value,
  })
}

async function syncEditorByMode() {
  teardownEditor()
  await nextTick()
  initCodeMirror()
}

onMounted(() => {
  syncEditorByMode()
})

watch(() => props.modelValue, (val) => {
  if (!cmView || props.enableCollab) return
  const current = cmView.state.doc.toString()
  if (current !== val) {
    cmView.dispatch({
      changes: { from: 0, to: current.length, insert: val },
    })
  }
  if (props.enableMentions) {
    detectMentionFromValue(val)
  }
})

watch(effectiveMode, async mode => {
  await nextTick()
  cmView?.requestMeasure()
  if (mode === 'split') enhancePreviewCodeBlocks(previewPaneRef.value)
})

watch(() => props.livePreview, enabled => {
  if (!cmView) return
  cmView.dispatch({
    effects: livePreviewCompartment.reconfigure(enabled ? livePreviewExtensions() : []),
  })
})

watch(markdownRuntimeState, state => {
  if (state !== 'ready' || !props.livePreview || !cmView) return
  cmView.dispatch({
    effects: livePreviewCompartment.reconfigure(livePreviewExtensions()),
  })
})

watch(() => props.enableResourceReferences, () => {
  if (!cmView) return
  cmView.dispatch({
    effects: resourceReferenceCompartment.reconfigure(resourceReferenceExtensions()),
  })
})

watch(() => props.resourceReferenceLabels, (labels) => {
  if (!cmView || !props.enableResourceReferences) return
  cmView.dispatch({
    effects: updateResourceReferenceLabels.of(labels),
  })
}, { deep: true })

watch(() => props.editorAriaLabel, () => {
  if (!cmView) return
  cmView.dispatch({
    effects: contentAttributesCompartment.reconfigure(
      EditorView.contentAttributes.of(editorContentAttributes()),
    ),
  })
})

function getCmSelection() {
  return pEditorCommands.getCmSelection(cmView)
}

function cmInsert(from: number, to: number, text: string, cursorFrom?: number, cursorTo?: number) {
  pEditorCommands.cmInsert(cmView, from, to, text, cursorFrom, cursorTo)
}

function sv_wrap(before: string, after: string, placeholder: string) {
  pEditorCommands.sv_wrap(cmView, before, after, placeholder)
}

function sv_wrapLinePrefix(prefix: string, placeholder: string) {
  pEditorCommands.sv_wrapLinePrefix(cmView, prefix, placeholder)
}

function sv_insertLink() {
  pEditorCommands.sv_insertLink(cmView)
}

function sv_insertTable() {
  pEditorCommands.sv_insertTable(cmView)
}

function sv_insertHr() {
  pEditorCommands.sv_insertHr(cmView)
}

function sv_insertCodeBlock() {
  pEditorCommands.sv_insertCodeBlock(cmView)
}

function sv_insertMath() {
  pEditorCommands.sv_insertMath(cmView)
}

function sv_undo() {
  pEditorCommands.sv_undo(cmView)
}

function sv_redo() {
  pEditorCommands.sv_redo(cmView)
}

function toggleLineNumbers() {
  const next = !lineNumbersEnabled.value
  if (props.lineNumbers === undefined) internalLineNumbers.value = next
  else emit('update:lineNumbers', next)
  if (!cmView) return
  cmView.dispatch({
    effects: lineNumberCompartment.reconfigure(next ? [lineNumbers(), highlightActiveLineGutter()] : []),
  })
}

const pickerState = ref<{ open: boolean; type: MediaPickerType }>({
  open: false,
  type: 'song',
})

function insertEmbed(kind: 'post' | 'music' | 'video') {
  if (kind === 'post') {
    const id = window.prompt('输入文章 ID')?.trim()
    if (id) {
      const { from } = getCmSelection()
      cmInsert(from, from, `\n:::post{id="${id}"}:::\n`)
    }
    return
  }
  pickerState.value = {
    open: true,
    type: kind === 'music' ? 'song' : 'video',
  }
}

function handleMediaPickerSelect(item: MediaPickerItem) {
  pickerState.value.open = false
  const { from } = getCmSelection()
  const kind = item.type === 'video' ? 'video' : 'music'
  const md = `\n:::${kind}{id="${item.id}"}:::\n`
  cmInsert(from, from, md)
}

function executeCommand(command: PostEditorCommand) {
  executeEditorCommand(cmView, command, {
    triggerImageUpload,
    insertEmbed,
    insertReference,
  })
}

watch(() => props.lineNumbers, () => {
  if (!cmView) return
  cmView.dispatch({ effects: lineNumberCompartment.reconfigure(lineNumberExtensions()) })
})

const mention = ref({
  visible: false,
  loading: false,
  index: 0,
  x: 0,
  y: 0,
  results: [] as ReferenceSuggestion[],
  startPos: -1,
})

let mentionDebounce: ReturnType<typeof setTimeout> | null = null
let mentionRequest = 0

function detectMentionFromText(textBefore: string, pos: number) {
  const trigger = parseReferenceTrigger(textBefore)
  if (!trigger) {
    closeMention()
    return
  }
  mention.value.startPos = pos - (textBefore.length - trigger.start)
  mention.value.visible = true
  mention.value.loading = true
  mention.value.results = []

  const coords = cmView?.coordsAtPos(mention.value.startPos)
  if (coords) {
    const position = fitReferenceMenuPosition(coords, {
      width: window.innerWidth,
      height: window.innerHeight,
    })
    mention.value.x = position.left
    mention.value.y = position.top
  }

  if (mentionDebounce) clearTimeout(mentionDebounce)
  const request = ++mentionRequest
  mentionDebounce = setTimeout(async () => {
    try {
      const results = props.referenceAutocompleteScope === 'debate'
        ? await searchDebateReferenceSuggestions(trigger, 10)
        : await searchReferenceSuggestions(trigger, 10)
      if (request !== mentionRequest) return
      mention.value.results = results
      mention.value.visible = results.length > 0
      mention.value.index = 0
    } catch {
      if (request === mentionRequest) closeMention()
    } finally {
      if (request === mentionRequest) mention.value.loading = false
    }
  }, 120)
}

function detectMentionFromValue(value: string) {
  if (!props.enableMentions || !cmView) return
  const pos = cmView.state.selection.main.head
  const doc = cmView.state.doc
  const line = doc.lineAt(pos)
  const textBefore = line.text.slice(0, pos - line.from)
  detectMentionFromText(textBefore, pos)
}

function insertReference() {
  if (!cmView) return
  const { from, to } = cmView.state.selection.main
  const result = insertReferenceTrigger(cmView.state.doc.toString(), from, to)
  cmView.dispatch({
    changes: { from, to, insert: result.insert },
    selection: { anchor: result.cursor },
  })
  cmView.focus()
}

function applyReference(suggestion: ReferenceSuggestion) {
  if (!cmView) return
  const pos = cmView.state.selection.main.head
  const insertText = referenceTokenForSuggestion(suggestion)
  cmView.dispatch({
    changes: { from: mention.value.startPos, to: pos, insert: insertText },
    selection: { anchor: mention.value.startPos + insertText.length },
  })
  cmView.focus()
  if (suggestion.kind === 'target') closeMention()
}

function closeMention() {
  mention.value.visible = false
  mention.value.loading = false
  mention.value.results = []
  mention.value.startPos = -1
  mentionRequest++
}

function onContainerKeydown(e: KeyboardEvent) {
  if (!mention.value.visible) return
  if (e.key === 'Escape') {
    e.preventDefault()
    closeMention()
    return
  }
  const items = mention.value.results
  if (items.length === 0) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    mention.value.index = (mention.value.index + 1) % items.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    mention.value.index = (mention.value.index - 1 + items.length) % items.length
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault()
    applyReference(items[mention.value.index])
  }
}

watch(svPreviewHtml, async () => {
  await nextTick()
  enhancePreviewCodeBlocks(previewPaneRef.value)
})

defineExpose({
  scrollToHeadingLine,
  replaceDocument,
  sv_wrap,
  sv_wrapLinePrefix,
  sv_insertLink,
  sv_insertTable,
  sv_insertHr,
  sv_insertCodeBlock,
  sv_insertMath,
  sv_undo,
  sv_redo,
  triggerImageUpload,
  insertReference,
  executeCommand,
})

onBeforeUnmount(() => {
  teardownEditor()
})
</script>

<style scoped>
@import "./pEditorRuntime.css";
</style>
