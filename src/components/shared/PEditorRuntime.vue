<template>
  <div
    class="p-editor"
    :class="[noBorder ? 'no-border' : null, 'mode-' + effectiveMode]"
    data-testid="markdown-editor"
    :data-editor-mode="effectiveMode"
    @keydown="onContainerKeydown"
  >
    <div v-if="collabPeers.length > 0 && effectiveMode === 'split'" class="p-editor-presence">
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

    <div v-if="canShowModeSwitches" class="editor-mode-switches">
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
        <button type="button" class="tb-btn" :class="{ active: showLineNumbers }" title="行号" @click="toggleLineNumbers">行号</button>
      </div>

      <div class="tb-row">
        <span class="tb-row-label">插入</span>
        <button type="button" class="tb-btn" title="插入代码块" @click="sv_insertCodeBlock">代码块</button>
        <button type="button" class="tb-btn" title="插入链接" @click="sv_insertLink">链接</button>
        <button type="button" class="tb-btn" :class="{ uploading: uploadingImage }" title="上传图片" @click="triggerImageUpload">
          {{ uploadingImage ? '上传中…' : '图片' }}
        </button>
        <input ref="imageInputRef" type="file" accept="image/*" class="tb-hidden-input" @change="handleImageUploadFile" />
        <button type="button" class="tb-btn" title="插入表格" @click="sv_insertTable">表格</button>
        <button type="button" class="tb-btn" title="插入分割线" @click="sv_insertHr">分割线</button>
        <template v-if="enableEmbeds">
          <span class="tb-sep" />
          <button type="button" class="tb-btn" @click="insertEmbed('post')">文章</button>
          <button type="button" class="tb-btn" @click="insertEmbed('music')">音乐</button>
          <button type="button" class="tb-btn" @click="insertEmbed('video')">视频</button>
        </template>
      </div>
    </div>

    <div
      class="p-editor-body"
      :class="[effectiveMode === 'split' ? 'p-editor-sv-body' : 'p-editor-normal-body', { dragging: isDragging }]"
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <div :class="effectiveMode === 'split' ? 'sv-pane sv-source' : null">
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

    <div
      v-if="mention.visible && mention.results.length > 0"
      class="p-mention-dropdown"
      :style="{ top: mention.y + 'px', left: mention.x + 'px' }"
    >
      <button
        v-for="(user, i) in mention.results"
        :key="user.username"
        type="button"
        class="mention-item"
        :class="{ 'is-active': i === mention.index }"
        @mousedown.prevent="applyMention(user)"
      >
        <span class="mention-name">{{ user.display_name || user.username }}</span>
        <span class="mention-username">@{{ user.username }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Quote } from 'lucide-vue-next'
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder as cmPlaceholder, scrollPastEnd } from '@codemirror/view'
import { Compartment, EditorState, RangeSetBuilder } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { yCollab } from 'y-codemirror.next'
import { useApi, useWebSocketUrl } from '@/composables/useApi'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import { useAuthStore } from '@/stores/auth'

interface Peer { clientId: number; name: string; color: string }
interface MentionUser { uuid: string; username: string; display_name: string; avatar_url: string }

interface Props {
  modelValue?: string
  mode: 'normal' | 'split'
  placeholder?: string
  noBorder?: boolean
  showModeToggle?: boolean
  showSyncScrollToggle?: boolean
  syncScroll?: boolean
  showToolbar?: boolean
  enableImageUpload?: boolean
  enableMentions?: boolean
  enableEmbeds?: boolean
  enableCollab?: boolean
  collabRoomId?: string
  protectFirstLine?: boolean
  renderingLevel?: 'full' | 'comment'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '开始输入…',
  noBorder: false,
  showModeToggle: false,
  showSyncScrollToggle: false,
  syncScroll: true,
  showToolbar: true,
  enableImageUpload: true,
  enableMentions: false,
  enableEmbeds: false,
  enableCollab: false,
  collabRoomId: undefined,
  protectFirstLine: false,
  renderingLevel: 'full',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'active-heading-change': [line: number | null]
  'mode-change': [value: 'normal' | 'split']
  'update:syncScroll': [value: boolean]
  'collab-ready': [value: string]
}>()

const api = useApi()
const authStore = useAuthStore()
const { renderMarkdown } = useMarkdownRenderer()
const effectiveMode = computed<'normal' | 'split'>(() => (props.enableCollab ? 'split' : props.mode))
const canShowModeSwitches = computed(() => (
  (!props.enableCollab && props.showModeToggle) || (effectiveMode.value === 'split' && props.showSyncScrollToggle)
))
const canShowModeToggle = computed(() => !props.enableCollab && props.showModeToggle)

const svPreviewHtml = computed(() => renderMarkdown(props.modelValue))

const cmContainerRef = ref<HTMLElement | null>(null)
const previewPaneRef = ref<HTMLElement | null>(null)
const showLineNumbers = ref(false)
const lineNumberCompartment = new Compartment()
let cmView: EditorView | null = null

const CURSOR_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']
const myColor = CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)]
const myName = computed(() => authStore.user?.display_name || authStore.user?.username || '匿名')
const collabPeers = ref<Peer[]>([])

let ydoc: Y.Doc | null = null
let provider: WebsocketProvider | null = null
let ytext: Y.Text | null = null
let hasEmittedCollabReady = false

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
  provider?.destroy()
  ydoc?.destroy()
  provider = null
  ydoc = null
  ytext = null
  hasEmittedCollabReady = false
  collabPeers.value = []
  cmView?.destroy()
  cmView = null
}

function lineNumberExtensions() {
  return showLineNumbers.value ? [lineNumbers(), highlightActiveLineGutter()] : []
}

function emitCollabReadyIfNeeded() {
  if (hasEmittedCollabReady || !ytext) return
  hasEmittedCollabReady = true
  emit('collab-ready', ytext.toString())
}

function replaceDocument(markdown: string) {
  if (props.enableCollab && ytext) {
    if (ytext.length > 0) {
      ytext.delete(0, ytext.length)
    }
    if (markdown) {
      ytext.insert(0, markdown)
    }
    return
  }

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
  const toHide: Array<{ from: number; to: number }> = []
  const hide = Decoration.replace({})

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter(node) {
        const { name } = node

        if (name === 'HeaderMark') {
          const line = state.doc.lineAt(node.from)
          if (cursor < line.from || cursor > line.to) {
            toHide.push({ from: node.from, to: node.to })
          }
        } else if (name === 'QuoteMark') {
          const line = state.doc.lineAt(node.from)
          if (cursor < line.from || cursor > line.to) {
            toHide.push({ from: node.from, to: node.to })
          }
        } else if (name === 'EmphasisMark') {
          const parent = node.node.parent
          if (parent && (parent.name === 'Emphasis' || parent.name === 'StrongEmphasis')) {
            if (cursor < parent.from || cursor > parent.to) {
              toHide.push({ from: node.from, to: node.to })
            }
          }
        } else if (name === 'CodeMark') {
          const parent = node.node.parent
          if (parent && parent.name === 'InlineCode') {
            if (cursor < parent.from || cursor > parent.to) {
              toHide.push({ from: node.from, to: node.to })
            }
          }
        } else if (name === 'LinkMark' || name === 'URL') {
          let p = node.node.parent
          while (p && p.name !== 'Link') p = p.parent
          if (p) {
            if (cursor < p.from || cursor > p.to) {
              toHide.push({ from: node.from, to: node.to })
            }
          }
        }
      },
    })
  }

  toHide.sort((a, b) => a.from - b.from || a.to - b.to)
  const builder = new RangeSetBuilder<Decoration>()
  let lastTo = -1
  for (const { from, to } of toHide) {
    if (from >= lastTo) {
      builder.add(from, to, hide)
      lastTo = to
    }
  }
  return builder.finish()
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
  extensions.push(makeLivePreviewPlugin())
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
          fontSize: '2.25rem',
          lineHeight: '1.2',
          fontWeight: '800',
          marginBottom: '0.5rem',
          display: 'block',
        },
      })
    )
  }

  if (props.enableCollab && props.collabRoomId) {
    ydoc = new Y.Doc()
    provider = new WebsocketProvider(
      useWebSocketUrl(`/api/v1/collab/ws/${props.collabRoomId}`),
      props.collabRoomId,
      ydoc,
      { connect: true },
    )
    ytext = ydoc.getText('codemirror')

    provider.awareness.on('change', () => {
      const list: Peer[] = []
      provider!.awareness.getStates().forEach((state, clientId) => {
        if (clientId === provider!.awareness.clientID) return
        if (state.user) list.push({ clientId, name: state.user.name as string, color: state.user.color as string })
      })
      collabPeers.value = list
    })
    provider.awareness.setLocalStateField('user', { name: myName.value, color: myColor })

    if (ytext.length === 0 && props.modelValue) {
      ytext.insert(0, props.modelValue)
    }

    provider.on('sync', (isSynced: boolean) => {
      if (!isSynced) return
      emitCollabReadyIfNeeded()
    })

    extensions.push(yCollab(ytext, provider.awareness))
    cmView = new EditorView({
      state: EditorState.create({
        doc: ytext.toString(),
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

watch(effectiveMode, () => {
  syncEditorByMode()
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
  const { from, to, selectedText } = getCmSelection()
  const line = cmView.state.doc.lineAt(from)
  const lineStart = line.from
  const selected = selectedText || placeholder
  cmInsert(lineStart, to, prefix + selected, lineStart + prefix.length, lineStart + prefix.length + selected.length)
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
  if (!cmView) return
  showLineNumbers.value = !showLineNumbers.value
  cmView.dispatch({
    effects: lineNumberCompartment.reconfigure(lineNumberExtensions()),
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

const imageInputRef = ref<HTMLInputElement | null>(null)
const uploadingImage = ref(false)

function triggerImageUpload() {
  imageInputRef.value?.click()
}

async function handleImageUploadFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (imageInputRef.value) imageInputRef.value.value = ''
  await uploadImage(file)
}

async function uploadImage(file: File) {
  if (!cmView) return
  const uploadId = Math.random().toString(36).slice(2, 8)
  const placeholder = `![上传中-${uploadId}]()`

  const { from } = getCmSelection()
  cmInsert(from, from, placeholder)

  uploadingImage.value = true
  try {
    const formData = new FormData()
    formData.append('image', file)
    const res = await fetch(api.blog.uploadImage, {
      method: 'POST',
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
      body: formData,
    })
    if (!res.ok) throw new Error('upload failed')
    const data = await res.json()
    const url: string = data.url

    const doc = cmView.state.doc.toString()
    const idx = doc.indexOf(placeholder)
    if (idx !== -1) {
      const finalMd = `![图片](${url})`
      cmView.dispatch({
        changes: { from: idx, to: idx + placeholder.length, insert: finalMd },
      })
    }
  } catch (err) {
    console.error('Image upload failed', err)
    const doc = cmView.state.doc.toString()
    const idx = doc.indexOf(placeholder)
    if (idx !== -1) {
      cmView.dispatch({ changes: { from: idx, to: idx + placeholder.length, insert: '' } })
    }
  } finally {
    uploadingImage.value = false
  }
}

function onCmPaste(e: ClipboardEvent) {
  if (!props.enableImageUpload) return
  const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'))
  if (files.length === 0) return
  e.preventDefault()
  files.forEach((f) => uploadImage(f))
}

const isDragging = ref(false)

function onDragOver() {
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  if (!props.enableImageUpload) return
  handleDropFiles(e.dataTransfer?.files)
}

function handleDropFiles(files?: FileList | null) {
  if (!files) return
  const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
  imageFiles.forEach((f) => uploadImage(f))
}

const mention = ref({
  visible: false,
  query: '',
  index: 0,
  x: 0,
  y: 0,
  results: [] as MentionUser[],
  startPos: -1,
})

let mentionDebounce: ReturnType<typeof setTimeout> | null = null

function detectMentionFromText(textBefore: string, pos: number) {
  const match = textBefore.match(/@([\w一-龥-]*)$/)
  if (!match) {
    closeMention()
    return
  }

  const query = match[1]
  mention.value.startPos = pos - match[0].length
  mention.value.query = query

  const coords = cmView?.coordsAtPos(mention.value.startPos)
  if (coords) {
    mention.value.x = coords.left
    mention.value.y = coords.bottom + 4
  }

  if (mentionDebounce) clearTimeout(mentionDebounce)
  mentionDebounce = setTimeout(() => fetchMentionUsers(query), 120)
}

function detectMentionFromValue(value: string) {
  if (!props.enableMentions || !cmView) return
  const pos = cmView.state.selection.main.head
  const doc = cmView.state.doc
  const line = doc.lineAt(pos)
  const textBefore = line.text.slice(0, pos - line.from)
  detectMentionFromText(textBefore || value, pos)
}

async function fetchMentionUsers(q: string) {
  try {
    const headers: Record<string, string> = {}
    if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`
    const res = await fetch(`${api.users.search}?scope=mention&q=${encodeURIComponent(q)}&limit=5`, { headers })
    if (!res.ok) return
    const data = await res.json()
    mention.value.results = data.data || []
    mention.value.visible = mention.value.results.length > 0
    mention.value.index = 0
  } catch {
    // ignore
  }
}

function applyMention(user: MentionUser) {
  if (!cmView) return
  const pos = cmView.state.selection.main.head
  const insertText = `@${user.username}`
  cmView.dispatch({
    changes: { from: mention.value.startPos, to: pos, insert: insertText },
    selection: { anchor: mention.value.startPos + insertText.length },
  })
  cmView.focus()
  closeMention()
}

function closeMention() {
  mention.value.visible = false
  mention.value.results = []
  mention.value.startPos = -1
}

function onContainerKeydown(e: KeyboardEvent) {
  if (!mention.value.visible) return
  const items = mention.value.results
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    mention.value.index = (mention.value.index + 1) % items.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    mention.value.index = (mention.value.index - 1 + items.length) % items.length
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault()
    applyMention(items[mention.value.index])
  } else if (e.key === 'Escape') {
    closeMention()
  }
}

function enhancePreviewDom() {
  const root = previewPaneRef.value
  if (!root) return

  const blocks = root.querySelectorAll('pre > code')
  blocks.forEach((code) => {
    const pre = code.parentElement
    if (!pre || pre.dataset.enhanced === 'true') return
    pre.dataset.enhanced = 'true'

    const langMatch = code.className.match(/(?:language|lang)-(\w+)/)
    const detectedLanguage = langMatch ? langMatch[1] : ''

    const titlebar = document.createElement('div')
    titlebar.className = 'code-block-titlebar'

    const lights = document.createElement('div')
    lights.className = 'code-block-lights'
    lights.innerHTML = '<span class="code-block-dot dot-red"></span><span class="code-block-dot dot-yellow"></span><span class="code-block-dot dot-green"></span>'
    titlebar.append(lights)

    if (detectedLanguage) {
      const langLabel = document.createElement('span')
      langLabel.className = 'code-block-lang'
      langLabel.textContent = detectedLanguage
      titlebar.append(langLabel)
    }

    const copyButton = document.createElement('button')
    copyButton.type = 'button'
    copyButton.className = 'code-block-copy'
    copyButton.textContent = '复制'
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.textContent || '')
        copyButton.textContent = '已复制'
        window.setTimeout(() => { copyButton.textContent = '复制' }, 1500)
      } catch {
        copyButton.textContent = '复制失败'
        window.setTimeout(() => { copyButton.textContent = '复制' }, 1500)
      }
    })
    titlebar.append(copyButton)
    pre.prepend(titlebar)
  })
}

watch(svPreviewHtml, async () => {
  await nextTick()
  enhancePreviewDom()
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
  sv_undo,
  sv_redo,
  triggerImageUpload,
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
  position: relative;
  min-height: 10rem;
  flex: 1;
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

.cm-container {
  flex: 1;
  height: 100%;
  min-height: 16rem;
}

.p-editor-normal-body .cm-container {
  min-height: 10rem;
}

:deep(.cm-editor) {
  height: 100%;
}

:deep(.cm-scroller) {
  overflow: auto;
}

.sv-preview {
  padding: 1.5rem 1.5rem 2rem;
  background: #fff;
  overflow: auto;
  min-height: 16rem;
}

.p-mention-dropdown {
  position: fixed;
  z-index: 9999;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  min-width: 200px;
  box-shadow: none;
  max-height: 200px;
  overflow-y: auto;
}

.mention-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.6rem 0.9rem;
  border: none;
  background: #fff;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}

.mention-item:hover,
.mention-item.is-active {
  background: #000;
  color: #fff;
}

.mention-name {
  font-size: 0.82rem;
  font-weight: 500;
}

.mention-username {
  font-size: 0.72rem;
  color: #9ca3af;
}

.mention-item.is-active .mention-username {
  color: #d1d5db;
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
