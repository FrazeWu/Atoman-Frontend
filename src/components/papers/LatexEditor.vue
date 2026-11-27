<template>
  <div class="papers-latex-editor">
    <div ref="editorRoot" class="latex-editor-host" aria-label="LaTeX 源码编辑器" />
    <div class="latex-editor-tools" aria-label="源码编辑工具">
      <PButton aria-label="查找替换" size="sm" variant="secondary" type="button" title="Ctrl/Cmd + F" @click="find"><Search :size="14" aria-hidden="true"/><span class="latex-editor-tool-label">查找替换</span></PButton>
      <PButton aria-label="撤销" size="sm" variant="secondary" v-if="collaborativeText" type="button" title="Ctrl/Cmd + Z" :disabled="readonly||!canUndo" @click="runUndo(false)"><Undo2 :size="14" aria-hidden="true"/><span class="latex-editor-tool-label">撤销</span></PButton>
      <PButton aria-label="重做" size="sm" variant="secondary" v-if="collaborativeText" type="button" title="Ctrl/Cmd + Shift + Z" :disabled="readonly||!canRedo" @click="runUndo(true)"><Redo2 :size="14" aria-hidden="true"/><span class="latex-editor-tool-label">重做</span></PButton>
      <PButton aria-label="命令补全" size="sm" variant="secondary" type="button" title="Ctrl + Space" :disabled="readonly" @click="complete"><Braces :size="14" aria-hidden="true"/><span class="latex-editor-tool-label">命令补全</span></PButton>
      <span>{{ position }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import PButton from '@/components/ui/PButton.vue'
import { Search, Undo2, Redo2, Braces } from 'lucide-vue-next'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Compartment, EditorState, Prec, StateEffect, StateField } from '@codemirror/state'
import { EditorView, Decoration, type DecorationSet, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import {openSearchPanel} from '@codemirror/search'
import {startCompletion} from '@codemirror/autocomplete'
import {latexExtensionsFor} from './latexLanguage'
import {paperAIReplacement,type PaperAIEdit,type PaperAISourceRange} from './aiSuggestion'
import {UndoManager,type Text as YText} from 'yjs'
import {yCollab,ySyncFacet,ySyncAnnotation} from 'y-codemirror.next'
import {remoteCursorDecorations,type CollaborationPeer,type LocalSelection} from './paperPresence'

const props = defineProps<{ modelValue: string; readonly?: boolean; citations?: readonly string[]; collaborativeText?: YText; remotePeers?: readonly CollaborationPeer[]; canEditCollaboration?:()=>boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; 'show-pdf': []; 'cursor-line': [line:number]; 'presence-selection':[selection:LocalSelection|null] }>()
const editorRoot = ref<HTMLElement | null>(null)
let editor: EditorView | null = null
let applyingExternalValue = false
let undoManager:UndoManager|null=null
const canUndo=ref(false),canRedo=ref(false)
function refreshUndo(){
 // Keep the number of retained undo groups bounded. Clearing releases
 // retained deleted structs; it never changes the document.
 if(undoManager&&undoManager.undoStack.length+undoManager.redoStack.length>100){
  undoManager.clear()
 }
 canUndo.value=!!undoManager?.undoStack.length
 canRedo.value=!!undoManager?.redoStack.length
}
function runUndo(redo:boolean):boolean{
 if(!editor||!undoManager||props.readonly||editor.state.readOnly||props.canEditCollaboration?.()===false)return false
 undoManager.stopCapturing()
 if(redo)undoManager.redo()
 else undoManager.undo()
 undoManager.stopCapturing()
 refreshUndo()
 editor.focus()
 return true
}
function undoCommand(redo:boolean):boolean{
 runUndo(redo)
 // Consume browser history commands even when read-only, never fall
 // through to an unguarded native or ordinary full-text undo.
 return true
}
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
        ...(props.collaborativeText?[EditorState.lineSeparator.of('\n'), yCollab(props.collaborativeText,null,{undoManager:false}),remoteCursors,
          EditorState.transactionFilter.of(transaction=>{
           // The reactive readonly prop can lag a socket policy close by
           // one render. Refuse local changes immediately, but continue
           // applying authoritative Yjs updates to a read-only editor.
           if(transaction.docChanged&&transaction.annotation(ySyncAnnotation)!==transaction.startState.facet(ySyncFacet)&&
              (transaction.startState.readOnly||props.canEditCollaboration?.()===false))return []
           return transaction
          }),
          Prec.highest(keymap.of([
           {key:'Mod-z',run:()=>undoCommand(false),preventDefault:true},
           {key:'Mod-y',mac:'Mod-Shift-z',run:()=>undoCommand(true),preventDefault:true},
           {key:'Mod-Shift-z',run:()=>undoCommand(true),preventDefault:true},
          ])),
          EditorView.domEventHandlers({beforeinput:event=>{
           if(event.inputType==='historyUndo'||event.inputType==='historyRedo'){
            event.preventDefault()
            return undoCommand(event.inputType==='historyRedo')
           }
           return false
          }})
        ]:[history()]),
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
  if(props.collaborativeText){
   // Only this editor's sync origin enters undo history. Server updates,
   // restored drafts and other editors' changes never enter the stack.
   undoManager=new UndoManager(props.collaborativeText,{
    trackedOrigins:new Set([editor.state.facet(ySyncFacet)]),
    captureTimeout:500,
   })
   for(const event of ['stack-item-added','stack-item-popped','stack-cleared','stack-item-updated'] as const){
    undoManager.on(event,refreshUndo)
   }
   refreshUndo()
  }
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
 if(!editor||props.readonly||props.canEditCollaboration?.()===false||!key||/[\\{}%,\s]/.test(key))return
 editor.dispatch(editor.state.replaceSelection('\\cite{'+key+'}'))
 editor.focus()
}
// Insert at the active end of the selection, preserving all selected text.
function insertBlock(block:string):boolean{
 if(!editor||props.readonly||props.canEditCollaboration?.()===false||!block.trim())return false
 const pos=editor.state.selection.main.head,doc=editor.state.doc
 const before=pos>0&&doc.sliceString(pos-1,pos)!=='\n'?'\n':''
 const after=pos<doc.length&&doc.sliceString(pos,pos+1)==='\n'?'':'\n'
 const insert=before+block.trim()+after
 editor.dispatch({changes:{from:pos,insert},selection:{anchor:pos+insert.length},scrollIntoView:true,userEvent:'input'})
 editor.focus()
 return true
}
// AI suggestions must pass through a normal CodeMirror transaction so undo
// and the workspace's existing save/version checks remain authoritative.
function getAISelection():PaperAISourceRange|null{
 if(!editor||props.readonly||editor.state.readOnly||props.canEditCollaboration?.()===false)return null
 const main=editor.state.selection.main
 if(main.empty)return null
 return {from:main.from,to:main.to,baseline:editor.state.doc.toString()}
}
function acceptAIEdit(edit:PaperAIEdit):boolean{
 if(!editor||props.readonly||editor.state.readOnly||props.canEditCollaboration?.()===false)return false
 const current=editor.state.doc.toString()
 const next=paperAIReplacement(current,edit)
 if(next===null)return false
 // Make the accepted suggestion one isolated local undo group.
 // y-codemirror publishes the regular local transaction; no legacy save.
 undoManager?.stopCapturing()
 editor.dispatch({changes:{from:edit.from,to:edit.to,insert:edit.replacement},selection:{anchor:edit.from,head:edit.from+edit.replacement.length},scrollIntoView:true,userEvent:'input'})
 undoManager?.stopCapturing()
 editor.focus()
 return editor.state.doc.toString()===next
}
function focusEditor(){editor?.focus()}
defineExpose({focusEditor,getLine,goToLine,goToMatch,insertCitation,insertBlock,runUndo,getAISelection,acceptAIEdit})

onBeforeUnmount(() => {
  undoManager?.destroy()
  undoManager=null
  editor?.destroy()
  editor = null
})
</script>

<style scoped>
.papers-latex-editor { display:flex;flex-direction:column; min-height: 0; height: 100%; overflow: hidden; background: var(--a-color-bg,#fff);color:var(--a-color-text,#20242c);container:papers-editor / inline-size; }
.papers-latex-editor :deep(.cm-editor) { height: 100%; min-height: 0; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 13px; line-height: 1.7; }
.papers-latex-editor :deep(.cm-scroller) { overflow: auto; }
.papers-latex-editor :deep(.cm-gutters) { border-right:1px solid var(--a-color-border-soft,#e5e7eb);background:var(--a-color-bg-soft,#f1f3f5);color:var(--a-color-text-secondary,#64748b); }
.papers-latex-editor :deep(.cm-focused) { outline: none; }
.papers-latex-editor :deep(.cm-activeLine),.papers-latex-editor :deep(.cm-activeLineGutter){background:var(--a-color-bg-soft,#e8eff5)}
.papers-latex-editor :deep(.cm-cursor){border-left-color:currentColor}
.papers-latex-editor :deep(.papers-remote-cursor){position:relative;display:inline-block;width:0;height:1.15em;border-left:2px solid;vertical-align:text-bottom;pointer-events:none;z-index:3}
.papers-latex-editor :deep(.papers-remote-cursor-label){position:absolute;left:-2px;bottom:100%;font:10px/1.3 sans-serif;color:white;border-radius:3px 3px 3px 0;padding:2px 4px;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis}
.latex-editor-host{flex:1;min-height:0;overflow:hidden}
.latex-editor-tools{--a-control-height-sm:25px;display:flex;align-items:center;flex-wrap:wrap;gap:4px;padding:2px 6px;border-top:1px solid var(--a-color-border-soft,#ddd);font-size:11px;flex-shrink:0;background:var(--a-color-bg,#fff)}
.latex-editor-tools :deep(.p-button){padding:0 5px;gap:4px;font-size:11px}
.latex-editor-tools :deep(.p-button svg){flex:none}
@container papers-editor (max-width:340px){.latex-editor-tool-label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.latex-editor-tools :deep(.p-button){min-width:26px;padding-inline:4px}}
@media(pointer:coarse){.latex-editor-tools{--a-control-height-sm:32px}}
.latex-editor-tools>span{margin-left:auto;white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--a-color-text-secondary,#64748b)}
.papers-latex-editor :deep(.cm-panel){font-size:12px;overflow-wrap:anywhere}
.papers-latex-editor :deep(.cm-tooltip-autocomplete){max-width:100%;z-index:30}
@media(prefers-color-scheme:dark){.papers-latex-editor{--papers-command:#82bfff;--papers-definition:#d4a4fa;--papers-comment:#a6c99b;--papers-bracket:#e2c28c;--papers-operator:#eab0d8}}
</style>
