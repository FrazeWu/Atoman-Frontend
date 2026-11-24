<template>
  <div class="papers-latex-editor">
    <div class="latex-editor-tools">
      <button type="button" title="Ctrl/Cmd + F" @click="find">查找替换</button>
      <button type="button" title="Ctrl + Space" :disabled="readonly" @click="complete">命令补全</button>
      <span>{{ position }}</span>
    </div>
    <div ref="editorRoot" class="latex-editor-host" aria-label="LaTeX 源码编辑器" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import {openSearchPanel} from '@codemirror/search'
import {startCompletion} from '@codemirror/autocomplete'
import {latexExtensions} from './latexLanguage'

const props = defineProps<{ modelValue: string; readonly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; 'show-pdf': []; 'cursor-line': [line:number] }>()
const editorRoot = ref<HTMLElement | null>(null)
let editor: EditorView | null = null
let applyingExternalValue = false
const position=ref("行 1，列 1")
function find(){if(editor)openSearchPanel(editor)}
function complete(){if(editor&&!props.readonly){editor.focus();startCompletion(editor)}}
const readonlyCompartment=new Compartment()

onMounted(() => {
  if (!editorRoot.value) return
  editor = new EditorView({
    parent: editorRoot.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        keymap.of([{key:'Mod-Shift-j',run:()=>{emit('show-pdf');return true}}, ...defaultKeymap, ...historyKeymap, indentWithTab]),
        ...latexExtensions,
        EditorView.lineWrapping,
        readonlyCompartment.of([EditorState.readOnly.of(Boolean(props.readonly)),EditorView.editable.of(!props.readonly)]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !applyingExternalValue) emit('update:modelValue', update.state.doc.toString())
          if(update.selectionSet||update.docChanged){const line=update.state.doc.lineAt(update.state.selection.main.head);position.value='行 '+line.number+'，列 '+(update.state.selection.main.head-line.from+1);emit('cursor-line',line.number)}
        }),
      ],
    }),
  })
})

watch(()=>props.readonly,value=>{
  editor?.dispatch({effects:readonlyCompartment.reconfigure([EditorState.readOnly.of(Boolean(value)),EditorView.editable.of(!value)])})
})

watch(() => props.modelValue, (next) => {
  if (!editor || editor.state.doc.toString() === next) return
  applyingExternalValue = true
  try {
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: next } })
  } finally {
    applyingExternalValue = false
  }
})

function getLine(){return editor?editor.state.doc.lineAt(editor.state.selection.main.head).number:1}
function goToLine(number:number){
 if(!editor)return
 const line=editor.state.doc.line(Math.max(1,Math.min(editor.state.doc.lines,Math.trunc(number)||1)))
 editor.dispatch({selection:{anchor:line.from,head:line.to},effects:EditorView.scrollIntoView(line.from,{y:'center'})})
 editor.focus()
}
defineExpose({getLine,goToLine})

onBeforeUnmount(() => {
  editor?.destroy()
  editor = null
})
</script>

<style scoped>
.papers-latex-editor { display:flex;flex-direction:column; min-height: 0; height: 100%; overflow: hidden; background: var(--a-color-bg,#fff);color:var(--a-color-text,#20242c); }
.papers-latex-editor :deep(.cm-editor) { height: 100%; min-height: 0; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 13px; line-height: 1.65; }
.papers-latex-editor :deep(.cm-scroller) { overflow: auto; }
.papers-latex-editor :deep(.cm-gutters) { border-right:1px solid var(--a-color-border-soft,#e5e7eb);background:var(--a-color-bg-soft,#f1f3f5);color:var(--a-color-text-secondary,#64748b); }
.papers-latex-editor :deep(.cm-focused) { outline: none; }
.papers-latex-editor :deep(.cm-activeLine),.papers-latex-editor :deep(.cm-activeLineGutter){background:var(--a-color-bg-soft,#e8eff5)}
.papers-latex-editor :deep(.cm-cursor){border-left-color:currentColor}
.latex-editor-host{flex:1;min-height:0;overflow:hidden}
.latex-editor-tools{display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid var(--a-color-border-soft,#ddd);font-size:11px}
.latex-editor-tools button{background:transparent;color:inherit;font:inherit;border:1px solid var(--a-color-border-soft,#ddd);border-radius:4px;padding:4px 6px}
.latex-editor-tools span{margin-left:auto;color:var(--a-color-text-secondary,#64748b)}
.papers-latex-editor :deep(.cm-panel){font-size:12px;overflow-wrap:anywhere}
.papers-latex-editor :deep(.cm-tooltip-autocomplete){max-width:100%;z-index:30}
@media(prefers-color-scheme:dark){.papers-latex-editor{--papers-command:#82bfff;--papers-definition:#d4a4fa;--papers-comment:#a6c99b;--papers-bracket:#e2c28c;--papers-operator:#eab0d8}}
</style>
