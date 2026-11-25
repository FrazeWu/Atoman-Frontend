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
import { Compartment, EditorState, StateEffect, StateField } from '@codemirror/state'
import { EditorView, Decoration, type DecorationSet, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import {openSearchPanel} from '@codemirror/search'
import {startCompletion} from '@codemirror/autocomplete'
import {latexExtensionsFor} from './latexLanguage'
import type {Text as YText} from 'yjs'
import {yCollab} from 'y-codemirror.next'
import {remoteCursorDecorations,type CollaborationPeer,type LocalSelection} from './paperPresence'

const props = defineProps<{ modelValue: string; readonly?: boolean; citations?: readonly string[]; collaborativeText?: YText; remotePeers?: readonly CollaborationPeer[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; 'show-pdf': []; 'cursor-line': [line:number]; 'presence-selection':[selection:LocalSelection|null] }>()
const editorRoot = ref<HTMLElement | null>(null)
let editor: EditorView | null = null
let applyingExternalValue = false
const position=ref("行 1，列 1")
function find(){if(editor)openSearchPanel(editor)}
function complete(){if(editor&&!props.readonly){editor.focus();startCompletion(editor)}}
const readonlyCompartment=new Compartment()
const refreshCursors=StateEffect.define<DecorationSet>()
const remoteCursors=StateField.define<DecorationSet>({
 create:()=>Decoration.none,
 update(value,transaction){
  let next=value.map(transaction.changes)
  for(const effect of transaction.effects)if(effect.is(refreshCursors))next=effect.value
  return next
 },
 provide:field=>EditorView.decorations.from(field),
})
function updateRemoteCursors(){
 if(!editor||!props.collaborativeText)return
 const decorations=remoteCursorDecorations(props.collaborativeText,props.remotePeers||[],editor.state.doc.length)
 editor.dispatch({effects:refreshCursors.of(decorations)})
}
function reportSelection(view:EditorView){
 if(!props.collaborativeText)return
 const main=view.state.selection.main
 emit('presence-selection',view.hasFocus?{anchor:main.anchor,head:main.head}:null)
}

onMounted(() => {
  if (!editorRoot.value) return
  editor = new EditorView({
    parent: editorRoot.value,
    state: EditorState.create({
      doc: props.collaborativeText?.toString() ?? props.modelValue,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        ...(props.collaborativeText?[EditorState.lineSeparator.of('\n'), yCollab(props.collaborativeText,null,{undoManager:false}),remoteCursors]:[history()]),
        keymap.of([{key:'Mod-Shift-j',run:()=>{emit('show-pdf');return true}}, ...defaultKeymap, ...(props.collaborativeText?[]:historyKeymap), indentWithTab]),
        ...latexExtensionsFor(()=>props.citations||[]),
        EditorView.lineWrapping,
        readonlyCompartment.of([EditorState.readOnly.of(Boolean(props.readonly)),EditorView.editable.of(!props.readonly)]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !applyingExternalValue && !props.collaborativeText) emit('update:modelValue', update.state.doc.toString())
          if(props.collaborativeText&&(update.selectionSet||update.docChanged||update.focusChanged))reportSelection(update.view)
          if(update.selectionSet||update.docChanged){const line=update.state.doc.lineAt(update.state.selection.main.head);position.value='行 '+line.number+'，列 '+(update.state.selection.main.head-line.from+1);emit('cursor-line',line.number)}
        }),
      ],
    }),
  })
  updateRemoteCursors()
})

watch([()=>props.remotePeers,()=>props.modelValue],updateRemoteCursors,{flush:'post'})

watch(()=>props.readonly,value=>{
  editor?.dispatch({effects:readonlyCompartment.reconfigure([EditorState.readOnly.of(Boolean(value)),EditorView.editable.of(!value)])})
})

watch(() => props.modelValue, (next) => {
  if (props.collaborativeText || !editor || editor.state.doc.toString() === next) return
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
function goToMatch(number:number,column:number,length:number){
 if(!editor)return
 const line=editor.state.doc.line(Math.max(1,Math.min(editor.state.doc.lines,Math.trunc(number)||1)))
 const from=Math.max(line.from,Math.min(line.to,line.from+Math.max(0,column-1)))
 const to=Math.max(from,Math.min(line.to,from+Math.max(0,length)))
 editor.dispatch({selection:{anchor:from,head:to},effects:EditorView.scrollIntoView(from,{y:'center'})})
 editor.focus()
}
function insertCitation(key:string){
 if(!editor||props.readonly||!key||/[\\{}%,\s]/.test(key))return
 editor.dispatch(editor.state.replaceSelection('\\cite{'+key+'}'))
 editor.focus()
}
// Insert at the active end of the selection, preserving all selected text.
function insertBlock(block:string):boolean{
 if(!editor||props.readonly||!block.trim())return false
 const pos=editor.state.selection.main.head,doc=editor.state.doc
 const before=pos>0&&doc.sliceString(pos-1,pos)!=='\n'?'\n':''
 const after=pos<doc.length&&doc.sliceString(pos,pos+1)==='\n'?'':'\n'
 const insert=before+block.trim()+after
 editor.dispatch({changes:{from:pos,insert},selection:{anchor:pos+insert.length},scrollIntoView:true,userEvent:'input'})
 editor.focus()
 return true
}
defineExpose({getLine,goToLine,goToMatch,insertCitation,insertBlock})

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
.papers-latex-editor :deep(.papers-remote-cursor){position:relative;display:inline-block;width:0;height:1.15em;border-left:2px solid;vertical-align:text-bottom;pointer-events:none;z-index:3}
.papers-latex-editor :deep(.papers-remote-cursor-label){position:absolute;left:-2px;bottom:100%;font:10px/1.3 sans-serif;color:white;border-radius:3px 3px 3px 0;padding:2px 4px;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis}
.latex-editor-host{flex:1;min-height:0;overflow:hidden}
.latex-editor-tools{display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid var(--a-color-border-soft,#ddd);font-size:11px}
.latex-editor-tools button{background:transparent;color:inherit;font:inherit;border:1px solid var(--a-color-border-soft,#ddd);border-radius:4px;padding:4px 6px}
.latex-editor-tools span{margin-left:auto;color:var(--a-color-text-secondary,#64748b)}
.papers-latex-editor :deep(.cm-panel){font-size:12px;overflow-wrap:anywhere}
.papers-latex-editor :deep(.cm-tooltip-autocomplete){max-width:100%;z-index:30}
@media(prefers-color-scheme:dark){.papers-latex-editor{--papers-command:#82bfff;--papers-definition:#d4a4fa;--papers-comment:#a6c99b;--papers-bracket:#e2c28c;--papers-operator:#eab0d8}}
</style>
