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

    <input ref="imageInputRef" type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="tb-hidden-input" @change="handleImageUploadFile" />
    <p v-if="uploadError" class="p-editor-upload-error" role="alert">{{ uploadError }}</p>

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
        @click="handlePreviewClick"
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

    <PEditorBubbleMenu
      v-if="bubble.visible"
      :position="{ top: bubble.y, left: bubble.x }"
      @command="handleBubbleCommand"
    />

    <PEditorSlashMenu
      v-if="slash.visible"
      :items="slashItems"
      :active-index="slash.index"
      :position="{ top: slash.y, left: slash.x }"
      @hover="slash.index = $event"
      @select="applySlashCommand"
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
import { Compartment, EditorState, Prec } from '@codemirror/state'
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
import PEditorBubbleMenu from './editor/PEditorBubbleMenu.vue'
import PEditorSlashMenu from './editor/PEditorSlashMenu.vue'
import {
  getSlashCommands,
  filterSlashCommands,
  type SlashMenuItem,
} from './editor/slashCommands'


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
  enableBubbleMenu?: boolean
  enableSlashMenu?: boolean
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
  enableBubbleMenu: true,
  enableSlashMenu: true,
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
let pendingCollabDocument: string | null = null
let collabFallbackTimer: ReturnType<typeof setTimeout> | null = null
const {
  imageInputRef,
  uploadError,
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
    pendingCollabDocument = value
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

    if (/^#{1,6}\s+.+/.test(lineText) && lineStart <= position) {
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

function handlePreviewClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const footnoteLink = target?.closest<HTMLAnchorElement>('a[data-footnote-ref], a[data-footnote-backref]')
  if (footnoteLink && previewPaneRef.value) {
    const href = footnoteLink.getAttribute('href')
    if (href && href.startsWith('#')) {
      const id = href.slice(1)
      const targetEl = previewPaneRef.value.querySelector<HTMLElement>(`#${CSS.escape(id)}`) || previewPaneRef.value.querySelector<HTMLElement>(`#${CSS.escape(decodeURIComponent(id))}`)
      if (targetEl) {
        event.preventDefault()
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        targetEl.classList.add('footnote-target-highlight')
        setTimeout(() => {
          targetEl.classList.remove('footnote-target-highlight')
        }, 1500)
      }
    }
  }
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
  // A sync that landed before the view existed has already chosen the document.
  // Clearing the flag here would let the local fallback replace that remote text.
  if (collabReady) return
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
    Prec.highest(EditorView.domEventHandlers({
      keydown: (event) => {
        if (!handleEditorKeydown(event)) return false
        event.stopPropagation()
        return true
      },
    })),
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
        if (slash.value.visible) repositionSlashMenu()
        if (bubble.value.visible) updateBubbleMenu()
      },
      paste: onCmPaste,
      drop: (event) => {
        event.preventDefault()
        event.stopPropagation()
        onDrop(event)
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
      if (props.enableSlashMenu && (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged)) {
        const pos = update.state.selection.main.head
        const doc = update.state.doc
        const line = doc.lineAt(pos)
        const textBefore = line.text.slice(0, pos - line.from)
        detectSlashCommand(textBefore, pos)
      }
      if (props.enableBubbleMenu && (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged)) {
        updateBubbleMenu()
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
        if (firstLine.startsWith('# ')) return tr

        const startText = tr.startState.doc.toString()
        if (startText === '# \n' || startText === '# ') {
          return tr
        }

        if (tr.newDoc.length === 0) {
          return [
            {
              changes: { from: 0, to: tr.startState.doc.length, insert: '# \n' },
              selection: { anchor: 2 },
            },
          ]
        }

        if (tr.startState.selection.main.empty && tr.startState.selection.main.head <= 2) {
          if (startText === '# \n' || startText === '# ') {
            return tr
          }
          return []
        }

        const atStart = tr.newSelection.main.head === 0
        return [
          tr,
          {
            changes: { from: 0, insert: '# ' },
            ...(atStart ? { selection: { anchor: 2 } } : {}),
          },
        ]
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
    collabReady = false
    pendingCollabDocument = null
    const session = collaboration.start(props.collabRoomId)
    extensions.push(session.extension)
    cmView = new EditorView({
      state: EditorState.create({
        doc: session.document,
        extensions,
      }),
      parent: cmContainerRef.value,
    })
    if (pendingCollabDocument != null && cmView.state.doc.toString() !== pendingCollabDocument) {
      cmView.dispatch({
        changes: { from: 0, to: cmView.state.doc.length, insert: pendingCollabDocument },
      })
    }
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

const bubble = ref({
  visible: false,
  x: 0,
  y: 0,
})

function closeBubbleMenu() {
  bubble.value.visible = false
}

function updateBubbleMenu() {
  if (!cmView || !props.enableBubbleMenu) {
    closeBubbleMenu()
    return
  }
  const selection = cmView.state.selection.main
  if (selection.empty || !cmView.hasFocus) {
    closeBubbleMenu()
    return
  }
  if (slash.value.visible || mention.value.visible) {
    closeBubbleMenu()
    return
  }

  try {
    const fromCoords = cmView.coordsAtPos(selection.from)
    const toCoords = cmView.coordsAtPos(selection.to)
    if (!fromCoords || !toCoords) {
      closeBubbleMenu()
      return
    }

    const bubbleWidth = 320
    const bubbleHeight = 36
    const margin = 10

    const minX = Math.min(fromCoords.left, toCoords.left)
    const maxX = Math.max(fromCoords.right, toCoords.right)
    const midX = (minX + maxX) / 2

    let left = midX - bubbleWidth / 2
    if (left + bubbleWidth > window.innerWidth - margin) {
      left = window.innerWidth - margin - bubbleWidth
    }
    if (left < margin) {
      left = margin
    }

    const topY = Math.min(fromCoords.top, toCoords.top)
    let top = topY - bubbleHeight - 8
    if (top < 52) {
      const bottomY = Math.max(fromCoords.bottom, toCoords.bottom)
      top = bottomY + 8
    }

    bubble.value = {
      visible: true,
      x: Math.round(left),
      y: Math.round(top),
    }
  } catch {
    closeBubbleMenu()
  }
}

function handleBubbleCommand(cmd: PostEditorCommand) {
  executeCommand(cmd)
}

const slash = ref({
  visible: false,
  index: 0,
  x: 0,
  y: 0,
  query: '',
  startPos: -1,
  endPos: -1,
})

function closeSlashMenu() {
  slash.value.visible = false
  slash.value.query = ''
  slash.value.startPos = -1
  slash.value.endPos = -1
  slash.value.index = 0
}

const allSlashCommands = computed(() => {
  return getSlashCommands({
    enableEmbeds: props.enableEmbeds,
    enableMentions: props.enableMentions,
    enableImageUpload: props.enableImageUpload,
  })
})

const slashItems = computed(() => {
  return filterSlashCommands(allSlashCommands.value, slash.value.query)
})

function repositionSlashMenu() {
  if (!cmView || !slash.value.visible || slash.value.startPos < 0) return
  const coords = cmView.coordsAtPos(slash.value.startPos)
  if (coords) {
    const menuWidth = 260
    const menuHeight = 280
    const margin = 12

    let left = coords.left
    if (left + menuWidth > window.innerWidth - margin) {
      left = window.innerWidth - menuWidth - margin
    }
    if (left < margin) left = margin

    let top = coords.bottom + 6
    if (top + menuHeight > window.innerHeight - margin) {
      top = Math.max(margin, coords.top - menuHeight - 6)
    }

    slash.value.x = Math.round(left)
    slash.value.y = Math.round(top)
  }
}

function detectSlashCommand(textBefore: string, pos: number) {
  if (!cmView || !props.enableSlashMenu) {
    if (slash.value.visible) closeSlashMenu()
    return
  }

  if (props.protectFirstLine) {
    const line = cmView.state.doc.lineAt(pos)
    if (line.number === 1) {
      if (slash.value.visible) closeSlashMenu()
      return
    }
  }

  const match = /^(\s*)\/([^\s]*)$/.exec(textBefore)
  if (!match) {
    if (slash.value.visible) closeSlashMenu()
    return
  }

  const query = match[2]
  const slashPos = pos - query.length - 1

  slash.value.startPos = slashPos
  slash.value.endPos = pos
  slash.value.query = query
  slash.value.visible = true

  const items = filterSlashCommands(allSlashCommands.value, query)
  if (slash.value.index >= items.length) {
    slash.value.index = 0
  }

  repositionSlashMenu()
}

function applySlashCommand(item: SlashMenuItem) {
  if (!cmView) return
  const from = slash.value.startPos
  const to = slash.value.endPos
  closeSlashMenu()

  item.execute({
    cmView,
    from,
    to,
    triggerImageUpload,
    insertEmbed,
    insertReference,
  })
}

function handleEditorKeydown(e: KeyboardEvent): boolean {
  if (slash.value.visible) {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeSlashMenu()
      return true
    }
    const items = slashItems.value
    if (items.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        slash.value.index = (slash.value.index + 1) % items.length
        return true
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        slash.value.index = (slash.value.index - 1 + items.length) % items.length
        return true
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const selected = items[slash.value.index]
        if (selected) {
          applySlashCommand(selected)
        }
        return true
      }
    }
  }

  if (mention.value.visible) {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeMention()
      return true
    }
    const items = mention.value.results
    if (items.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        mention.value.index = (mention.value.index + 1) % items.length
        return true
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        mention.value.index = (mention.value.index - 1 + items.length) % items.length
        return true
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const selected = items[mention.value.index]
        if (selected) {
          applyReference(selected)
        }
        return true
      }
    }
  }

  if (bubble.value.visible && e.key === 'Escape') {
    closeBubbleMenu()
    return false
  }

  return false
}

function onContainerKeydown(e: KeyboardEvent) {
  handleEditorKeydown(e)
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
