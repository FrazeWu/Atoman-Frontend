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
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AtSign, Quote } from 'lucide-vue-next'
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType, highlightActiveLine, highlightActiveLineGutter, highlightWhitespace, keymap, lineNumbers, placeholder as cmPlaceholder, scrollPastEnd } from '@codemirror/view'
import { Compartment, EditorState, RangeSetBuilder, StateField, type Text } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import { useAuthStore } from '@/stores/auth'
import { useEditorCollaboration } from '@/composables/editor/useEditorCollaboration'
import { useEditorImageUpload } from '@/composables/editor/useEditorImageUpload'
import PReferenceMenu from '@/components/shared/PReferenceMenu.vue'
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

function markdownTableCells(line: string) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map(cell => cell.trim())
}

function markdownTableDOM(source: string) {
  const lines = source.split('\n').filter(line => line.trim())
  if (lines.length < 2) return null
  const headers = markdownTableCells(lines[0])
  const dividers = markdownTableCells(lines[1])
  if (headers.length !== dividers.length || !dividers.every(cell => /^:?-+:?$/.test(cell))) return null

  const table = document.createElement('table')
  const head = document.createElement('thead')
  const headRow = document.createElement('tr')
  const body = document.createElement('tbody')
  const alignments = dividers.map(divider => {
    if (divider.startsWith(':') && divider.endsWith(':')) return 'center'
    if (divider.endsWith(':')) return 'right'
    return 'left'
  })

  headers.forEach((header, index) => {
    const cell = document.createElement('th')
    cell.textContent = header
    cell.style.textAlign = alignments[index]
    headRow.append(cell)
  })
  head.append(headRow)
  lines.slice(2).forEach(line => {
    const row = document.createElement('tr')
    markdownTableCells(line).forEach((value, index) => {
      const cell = document.createElement('td')
      cell.textContent = value
      cell.style.textAlign = alignments[index] || 'left'
      row.append(cell)
    })
    body.append(row)
  })
  table.append(head, body)
  return table
}

class MarkdownPreviewWidget extends WidgetType {
  constructor(
    private readonly html: string,
    private readonly sourcePosition: number,
    private readonly source: string,
  ) {
    super()
  }

  eq(other: MarkdownPreviewWidget) {
    return other.html === this.html
      && other.sourcePosition === this.sourcePosition
      && other.source === this.source
  }

  toDOM(view: EditorView) {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-markdown-widget prose-blog'
    const fence = this.source.match(/^\s*(```+|~~~+)([^\n]*)\n([\s\S]*?)\n\s*\1\s*$/)
    if (fence) {
      const pre = document.createElement('pre')
      const code = document.createElement('code')
      const language = fence[2].trim()
      if (language) code.className = `language-${language}`
      code.textContent = fence[3]
      pre.append(code)
      wrapper.append(pre)
    } else {
      const table = markdownTableDOM(this.source)
      if (table) {
        wrapper.append(table)
      } else {
        const template = document.createElement('template')
        // renderMarkdown sanitizes through DOMPurify before widgets receive the HTML.
        template.innerHTML = this.html
        wrapper.append(template.content.cloneNode(true))
      }
    }
    wrapper.addEventListener('click', event => {
      event.preventDefault()
      view.dispatch({ selection: { anchor: this.sourcePosition } })
      view.focus()
    })
    return wrapper
  }

  ignoreEvent() {
    return false
  }
}

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
  onReady: value => emit('collab-ready', value),
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

function teardownEditor() {
  if (mentionDebounce) {
    clearTimeout(mentionDebounce)
    mentionDebounce = null
  }
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

function buildLivePreviewDecos(view: EditorView): DecorationSet {
  const { state } = view
  const cursor = state.selection.main.head
  const ranges: Array<{ from: number; to: number; decoration: Decoration }> = []
  const hiddenMark = Decoration.replace({})
  const strikeText = Decoration.mark({ class: 'cm-markdown-strike' })

  const hideMark = (from: number, to: number) => {
    ranges.push({ from, to, decoration: hiddenMark })
  }
  const renderInlineWidget = (from: number, to: number) => {
    if (cursor >= from && cursor <= to) return false
    ranges.push({
      from,
      to,
      decoration: Decoration.replace({
        widget: new MarkdownPreviewWidget(
          renderMarkdown(state.sliceDoc(from, to)),
          from,
          state.sliceDoc(from, to),
        ),
      }),
    })
    return true
  }

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter(node) {
        const { name } = node
        if (name === 'Image') {
          const line = state.doc.lineAt(node.from)
          if (line.text.trim() === state.sliceDoc(node.from, node.to).trim()) {
            return !renderInlineWidget(line.from, line.to)
          }
        }
        if (name === 'HorizontalRule') return !renderInlineWidget(node.from, node.to)
        if (name === 'HeaderMark' || name === 'QuoteMark' || name === 'ListMark' || name === 'TaskMarker') {
          const line = state.doc.lineAt(node.from)
          if (cursor < line.from || cursor > line.to) hideMark(node.from, node.to)
          return
        }
        if (name === 'EmphasisMark' || name === 'StrikethroughMark' || name === 'CodeMark' || name === 'CodeInfo') {
          const parent = node.node.parent
          if (parent && (cursor < parent.from || cursor > parent.to)) hideMark(node.from, node.to)
          return
        }
        if (name === 'LinkMark' || name === 'URL') {
          let parent = node.node.parent
          while (parent && parent.name !== 'Link' && parent.name !== 'Image') parent = parent.parent
          if (parent && (cursor < parent.from || cursor > parent.to)) hideMark(node.from, node.to)
        }
      },
    })

    let line = state.doc.lineAt(from)
    while (line.from <= to) {
      if (cursor < line.from || cursor > line.to) {
        for (const match of line.text.matchAll(/~~([^~\n]+)~~/g)) {
          const start = line.from + (match.index || 0)
          const contentFrom = start + 2
          const contentTo = contentFrom + match[1].length
          hideMark(start, contentFrom)
          ranges.push({ from: contentFrom, to: contentTo, decoration: strikeText })
          hideMark(contentTo, contentTo + 2)
        }
      }
      if (line.number >= state.doc.lines) break
      line = state.doc.line(line.number + 1)
    }
  }

  ranges.sort((a, b) => a.from - b.from || b.to - a.to)
  const builder = new RangeSetBuilder<Decoration>()
  let lastTo = -1
  for (const range of ranges) {
    if (range.from < lastTo) continue
    builder.add(range.from, range.to, range.decoration)
    lastTo = range.to
  }
  return builder.finish()
}

function findClosingLine(doc: Text, startLine: number, marker: string) {
  for (let lineNumber = startLine + 1; lineNumber <= doc.lines; lineNumber += 1) {
    if (doc.line(lineNumber).text.trim() === marker) return lineNumber
  }
  return null
}

function findTableEndLine(doc: Text, startLine: number) {
  let endLine = startLine + 1
  for (let lineNumber = startLine + 2; lineNumber <= doc.lines; lineNumber += 1) {
    if (!/^\s*\|/.test(doc.line(lineNumber).text)) break
    endLine = lineNumber
  }
  return endLine
}

function buildBlockPreviewDecos(state: EditorState): DecorationSet {
  const cursor = state.selection.main.head
  const ranges: Array<{ from: number; to: number }> = []
  const addRange = (from: number, to: number) => {
    if (cursor < from || cursor > to) ranges.push({ from, to })
  }

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'FencedCode') return
      addRange(node.from, node.to)
      return false
    },
  })

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber)
    const trimmed = line.text.trim()
    if (trimmed === '$$' || /^:::(post|music|video)\{/.test(trimmed)) {
      const closingLine = findClosingLine(state.doc, lineNumber, trimmed === '$$' ? '$$' : ':::')
      if (closingLine) {
        addRange(line.from, state.doc.line(closingLine).to)
        lineNumber = closingLine
      }
      continue
    }
    if (!/^\s*\|/.test(line.text) || lineNumber >= state.doc.lines) continue
    if (!/^\s*\|?\s*:?-+/.test(state.doc.line(lineNumber + 1).text)) continue
    const endLine = findTableEndLine(state.doc, lineNumber)
    addRange(line.from, state.doc.line(endLine).to)
    lineNumber = endLine
  }

  ranges.sort((a, b) => a.from - b.from)
  const builder = new RangeSetBuilder<Decoration>()
  let lastTo = -1
  for (const range of ranges) {
    if (range.from < lastTo) continue
    builder.add(range.from, range.to, Decoration.replace({
      block: true,
      widget: new MarkdownPreviewWidget(
        renderMarkdown(state.sliceDoc(range.from, range.to)),
        range.from,
        state.sliceDoc(range.from, range.to),
      ),
    }))
    lastTo = range.to
  }
  return builder.finish()
}

function makeBlockPreviewField() {
  return StateField.define<DecorationSet>({
    create: state => buildBlockPreviewDecos(state),
    update: (decorations, transaction) => (
      transaction.docChanged || transaction.selection
        ? buildBlockPreviewDecos(transaction.state)
        : decorations
    ),
    provide: field => EditorView.decorations.from(field),
  })
}

function livePreviewExtensions() {
  return [makeLivePreviewPlugin(), makeBlockPreviewField()]
}

function makeLivePreviewPlugin() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = buildLivePreviewDecos(view)
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildLivePreviewDecos(update.view)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
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
      '.cm-content': { caretColor: '#000' },
      '.cm-cursor': { borderLeftColor: '#000' },
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

function getCmSelection(): { from: number; to: number; selectedText: string } {
  if (!cmView) return { from: 0, to: 0, selectedText: '' }
  const { from, to } = cmView.state.selection.main
  const selectedText = cmView.state.sliceDoc(from, to)
  return { from, to, selectedText }
}

function cmInsert(from: number, to: number, text: string, cursorFrom?: number, cursorTo?: number) {
  if (!cmView) return
  cmView.dispatch({
    changes: { from, to, insert: text },
    selection: cursorFrom !== undefined
      ? { anchor: cursorFrom, head: cursorTo ?? cursorFrom }
      : undefined,
  })
  cmView.focus()
}

function sv_wrap(before: string, after: string, placeholder: string) {
  const { from, to, selectedText } = getCmSelection()
  const inserted = selectedText || placeholder
  const newText = before + inserted + after
  cmInsert(from, to, newText, from + before.length, from + before.length + inserted.length)
}

function sv_wrapLinePrefix(prefix: string, placeholder: string) {
  if (!cmView) return
  const { from, to } = getCmSelection()
  const firstLine = cmView.state.doc.lineAt(from)
  const endPosition = to > from && to === cmView.state.doc.lineAt(to).from ? to - 1 : to
  const lastLine = cmView.state.doc.lineAt(Math.max(from, endPosition))
  const original = cmView.state.sliceDoc(firstLine.from, lastLine.to)
  const lines = original.split('\n')
  const shouldRemove = lines.every(line => !line.trim() || line.startsWith(prefix))
  const replacement = lines.map(line => {
    if (!line.trim()) return shouldRemove ? '' : `${prefix}${placeholder}`
    if (shouldRemove) return line.startsWith(prefix) ? line.slice(prefix.length) : line
    if (/^#{1,6}\s+$/.test(prefix) && /^#{1,6}\s+/.test(line)) {
      return `${prefix}${line.replace(/^#{1,6}\s+/, '')}`
    }
    return `${prefix}${line}`
  }).join('\n')
  cmInsert(firstLine.from, lastLine.to, replacement, firstLine.from, firstLine.from + replacement.length)
}

function sv_insertLink() {
  const { from, to, selectedText } = getCmSelection()
  const text = selectedText || '链接文字'
  const md = `[${text}](url)`
  cmInsert(from, to, md, from + 1, from + 1 + text.length)
}

function sv_insertTable() {
  const { from } = getCmSelection()
  const table = '\n| 标题 | 标题 | 标题 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n'
  cmInsert(from, from, table)
}

function sv_insertHr() {
  const { from } = getCmSelection()
  cmInsert(from, from, '\n---\n')
}

function sv_insertCodeBlock() {
  const { from, to, selectedText } = getCmSelection()
  const body = selectedText || '代码'
  const newText = `\n\`\`\`txt\n${body}\n\`\`\`\n`
  const bodyStart = from + '\n```txt\n'.length
  cmInsert(from, to, newText, bodyStart, bodyStart + body.length)
}

function sv_insertMath() {
  const { from, to, selectedText } = getCmSelection()
  const body = selectedText || '公式'
  const markdown = `\n$$\n${body}\n$$\n`
  const bodyStart = from + '\n$$\n'.length
  cmInsert(from, to, markdown, bodyStart, bodyStart + body.length)
}

function sv_undo() {
  if (!cmView) return
  undo({ state: cmView.state, dispatch: cmView.dispatch.bind(cmView) })
  cmView.focus()
}

function sv_redo() {
  if (!cmView) return
  redo({ state: cmView.state, dispatch: cmView.dispatch.bind(cmView) })
  cmView.focus()
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

function insertEmbed(kind: 'post' | 'music' | 'video') {
  const labels = { post: '文章', music: '音乐/专辑', video: '视频' }
  const id = window.prompt(`输入要引用的${labels[kind]} UUID`)?.trim()
  if (!id) return
  const { from } = getCmSelection()
  const md = `\n:::${kind}{id="${id}"}\n:::\n`
  cmInsert(from, from, md)
}

function executeCommand(command: PostEditorCommand) {
  switch (command) {
    case 'undo': sv_undo(); break
    case 'redo': sv_redo(); break
    case 'heading2': sv_wrapLinePrefix('## ', '标题'); break
    case 'heading3': sv_wrapLinePrefix('### ', '标题'); break
    case 'heading4': sv_wrapLinePrefix('#### ', '标题'); break
    case 'bold': sv_wrap('**', '**', '粗体文字'); break
    case 'italic': sv_wrap('*', '*', '斜体文字'); break
    case 'strike': sv_wrap('~~', '~~', '删除线'); break
    case 'blockquote': sv_wrapLinePrefix('> ', '引用内容'); break
    case 'bulletList': sv_wrapLinePrefix('- ', '列表项'); break
    case 'orderedList': sv_wrapLinePrefix('1. ', '列表项'); break
    case 'link': sv_insertLink(); break
    case 'image': triggerImageUpload(); break
    case 'table': sv_insertTable(); break
    case 'codeBlock': sv_insertCodeBlock(); break
    case 'horizontalRule': sv_insertHr(); break
    case 'math': sv_insertMath(); break
    case 'postEmbed': insertEmbed('post'); break
    case 'musicEmbed': insertEmbed('music'); break
    case 'videoEmbed': insertEmbed('video'); break
    case 'reference': insertReference(); break
  }
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
.p-editor {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  position: relative;
}

.p-editor:not(.no-border) {
  border: 1px solid var(--a-color-border-soft);
}

.p-editor-presence {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 1.25rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface);
  flex-shrink: 0;
}

.presence-avatars {
  display: flex;
  gap: 0.4rem;
}

.presence-dot {
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 500;
  font-size: 0.65rem;
  border: 1px solid var(--a-color-text);
  flex-shrink: 0;
}

.editor-mode-switches {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem 0;
  flex-wrap: wrap;
}

.editor-reference-trigger {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  cursor: pointer;
}

.editor-reference-trigger:hover {
  background: var(--a-color-surface-muted);
}

.editor-reference-trigger:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

.mode-switch {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  min-width: 8.5rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  padding: 0.55rem 0.75rem;
  cursor: pointer;
  color: var(--a-color-text);
  font: inherit;
  font-weight: var(--a-font-weight-strong, 700);
  line-height: 1;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.mode-switch:hover {
  background: var(--a-color-surface-muted);
}

.mode-switch-label {
  font-size: 0.84rem;
  letter-spacing: 0;
}

.mode-switch-state {
  min-width: 2.2rem;
  padding: 0.22rem 0.45rem;
  border: 1px solid var(--a-color-text);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: var(--a-font-weight-strong, 700);
  letter-spacing: 0;
}

.mode-switch.active {
  background: #000;
  color: #fff;
}

.mode-switch.active .mode-switch-state {
  background: #fff;
  color: #000;
}

.p-editor-toolbar {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.tb-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4rem 0.75rem;
}

.tb-row + .tb-row {
  border-top: 1px solid var(--a-color-border-soft);
}

.tb-row-label {
  font-size: 0.58rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
  color: var(--a-color-muted);
  margin-right: 0.2rem;
  flex-shrink: 0;
}

.tb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  font-size: 0.72rem;
  font-weight: var(--a-font-weight-strong, 700);
  font-family: inherit;
  cursor: pointer;
  letter-spacing: 0;
  line-height: 1;
  white-space: nowrap;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.tb-btn:hover,
.tb-btn.active {
  background: #000;
  color: #fff;
}

.tb-btn.uploading {
  opacity: 0.5;
  cursor: not-allowed;
}

.tb-sep {
  display: inline-block;
  width: 1px;
  height: 1.2rem;
  background: #d1d5db;
  margin: 0 0.2rem;
  flex-shrink: 0;
}

.tb-hidden-input {
  display: none;
}

.p-editor-sv-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  flex: 1;
  min-height: 0;
  position: relative;
}

.p-editor-normal-body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  position: relative;
}

.p-editor-sv-body.dragging::after,
.p-editor-normal-body.dragging::after {
  content: '松开鼠标上传图片';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.08);
  border: 1px solid var(--a-color-border-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: 1rem;
  color: #000;
  pointer-events: none;
  z-index: 5;
}

.sv-pane {
  min-height: 0;
  overflow: auto;
}

.toast-container {
  min-height: 20rem;
  height: 100%;
}

.sv-source {
  border-right: 1px solid var(--a-color-border-soft);
  display: flex;
  flex-direction: column;
}

.cm-source-pane {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.cm-container {
  flex: 1;
  height: 100%;
  min-height: 0;
}

.p-editor-normal-body .cm-container {
  min-height: 0;
}

:deep(.cm-editor) {
  height: 100%;
}

:deep(.cm-scroller) {
  overflow: auto;
}

:deep(.cm-highlightSpace),
:deep(.cm-highlightTab) {
  background-image: radial-gradient(circle at 50% 55%, #888 20%, transparent 5%);
  background-position: center;
  background-repeat: repeat-x;
  background-size: 0.35rem 0.35rem;
}

:deep(.cm-markdown-strike) {
  text-decoration: line-through;
}

:deep(.cm-markdown-widget) {
  display: block;
  width: 100%;
  margin: 0;
  padding-block: 0.5rem;
  cursor: text;
}

:deep(.cm-markdown-widget > :first-child) {
  margin-top: 0;
}

:deep(.cm-markdown-widget > :last-child) {
  margin-bottom: 0;
}

:deep(.cm-markdown-widget img) {
  display: block;
  max-width: 100%;
  max-height: 32rem;
  object-fit: contain;
}

:deep(.cm-markdown-widget pre) {
  overflow-x: auto;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface);
  color: var(--a-color-fg);
}

.sv-preview {
  padding: 1.5rem 1.5rem 2rem;
  background: #fff;
  overflow: auto;
  min-height: 16rem;
}

@media (max-width: 700px) {
  .p-editor-sv-body {
    grid-template-columns: 1fr;
  }

  .sv-source {
    border-right: none;
    border-bottom: 1px solid var(--a-color-border-soft);
  }

  .cm-container {
    min-height: 10rem;
  }
}

:deep(.sv-preview pre) {
  position: relative;
  padding-top: 2.5rem;
  overflow: hidden;
  background: #1e1e2e;
  border: 1px solid var(--a-color-border-soft);
  box-shadow: none;
  color: #cdd6f4;
}

:deep(.sv-preview pre code),
:deep(.sv-preview pre code.hljs) {
  background: transparent;
  color: inherit;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 0.82rem;
  line-height: 1.8;
}

:deep(.code-block-titlebar) {
  position: absolute;
  inset: 0 0 auto 0;
  height: 2.5rem;
  display: flex;
  align-items: center;
  padding: 0 0.85rem;
  background: #2d2d2d;
  border-bottom: 1px solid #3d3d3d;
}

:deep(.code-block-lights) {
  display: flex;
  gap: 0.42rem;
  align-items: center;
  flex-shrink: 0;
}

:deep(.code-block-dot) {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

:deep(.dot-red) {
  background: #ff5f57;
  border: 1px solid #e0443e;
}

:deep(.dot-yellow) {
  background: #ffbd2e;
  border: 1px solid #dea123;
}

:deep(.dot-green) {
  background: #28ca42;
  border: 1px solid #1aab2e;
}

:deep(.code-block-lang) {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 0.7rem;
  font-weight: 500;
  color: #9ca3af;
  letter-spacing: 0;
  text-transform: lowercase;
  pointer-events: none;
}

:deep(.code-block-copy) {
  margin-left: auto;
  background: transparent;
  border: 1px solid #4b5563;
  color: #9ca3af;
  font-size: 0.65rem;
  font-weight: 500;
  font-family: inherit;
  padding: 0.2rem 0.55rem;
  cursor: pointer;
  letter-spacing: 0;
  transition: background 150ms, color 150ms;
}

:deep(.code-block-copy:hover) {
  background: #9ca3af;
  color: #1a1a2e;
  border-color: #9ca3af;
}
</style>
.p-editor-label {
  font-size: var(--a-text-xs);
  font-weight: var(--a-font-weight-black);
  text-transform: uppercase;
  letter-spacing: 0;
}
