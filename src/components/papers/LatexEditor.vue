<template>
  <div class="papers-latex-editor">
    <div ref="editorRoot" class="latex-editor-host" aria-label="LaTeX 源码编辑器" />
    <section v-if="lintOpen&&supportsLint" class="latex-lint-panel" aria-label="源码检查结果">
      <div class="latex-lint-panel__heading">
        <strong>{{lintStatus}}</strong>
        <PButton v-if="checkProjectReferences" type="button" size="sm" variant="secondary" :loading="projectLintBusy" :disabled="projectLintBusy||readonly" @click="checkReferences">检查项目引用</PButton>
        <PButton type="button" size="sm" variant="ghost" aria-label="关闭源码检查" @click="lintOpen=false"><X :size="14" aria-hidden="true"/></PButton>
      </div>
      <p v-if="projectLintMessage" role="status">{{projectLintMessage}}</p>
      <p v-else-if="!projectCatalog&&checkProjectReferences">仅检查当前源码与项目文件路径。检查项目引用可补充跨文件标签和文献键。</p>
      <p v-if="lintPending" role="status">等待输入结束后检查…</p>
      <p v-else-if="lintSkipped">文件较大，已暂停本地静态扫描。</p>
      <p v-else-if="!lintRows.length">未发现当前检查范围内的问题。实际编译结果仍以 TeX 引擎为准。</p>
      <div v-if="!lintPending&&lintRows.length" class="latex-lint-panel__rows">
        <PButton v-for="(item,index) in lintRows" :key="item.code+':'+item.from+':'+index" type="button" size="sm" variant="ghost" class="latex-lint-panel__row" @click="jumpLint(item)">
          <AlertCircle :size="14" aria-hidden="true" :class="item.severity==='error'?'lint-error':'lint-warning'"/>
          <span><strong>第 {{item.line}} 行 · {{item.source}}</strong><span>{{item.message}}</span></span>
        </PButton>
      </div>
      <small v-if="lintTruncated">达到本地诊断数量上限，仅显示部分结果。</small>
      <small>静态提示不执行 TeX 宏，不会阻止保存或编译。</small>
    </section>
    <div class="latex-editor-tools" aria-label="源码编辑工具">
      <PButton aria-label="查找替换" size="sm" variant="secondary" type="button" title="Ctrl/Cmd + F" @click="find"><Search :size="14" aria-hidden="true"/><span class="latex-editor-tool-label">查找替换</span></PButton>
      <PButton aria-label="撤销" size="sm" variant="secondary" v-if="collaborativeText" type="button" title="Ctrl/Cmd + Z" :disabled="readonly||!canUndo" @click="runUndo(false)"><Undo2 :size="14" aria-hidden="true"/><span class="latex-editor-tool-label">撤销</span></PButton>
      <PButton aria-label="重做" size="sm" variant="secondary" v-if="collaborativeText" type="button" title="Ctrl/Cmd + Shift + Z" :disabled="readonly||!canRedo" @click="runUndo(true)"><Redo2 :size="14" aria-hidden="true"/><span class="latex-editor-tool-label">重做</span></PButton>
      <PButton aria-label="命令补全" size="sm" variant="secondary" type="button" title="Ctrl + Space · LaTeX 命令、引用与项目文件补全" :disabled="readonly" @click="complete"><Braces :size="14" aria-hidden="true"/><span class="latex-editor-tool-label">命令补全</span></PButton>
      <PButton v-if="supportsLint" type="button" size="sm" variant="secondary" aria-label="源码检查" :aria-expanded="lintOpen" :title="lintStatus+' · 点击查看源码问题'" @click="lintOpen=!lintOpen"><AlertCircle :size="14" aria-hidden="true" :class="lintRows.some(item=>item.severity==='error')?'lint-error':lintRows.length?'lint-warning':''"/><span class="latex-editor-tool-label">检查</span><span v-if="lintRows.length" class="latex-editor-lint-count">{{lintRows.length}}</span></PButton>
      <span>{{ position }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import PButton from '@/components/ui/PButton.vue'
import { Search, Undo2, Redo2, Braces, AlertCircle, X } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Compartment, EditorState, Prec, StateEffect, StateField } from '@codemirror/state'
import { EditorView, Decoration, type DecorationSet, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import {openSearchPanel} from '@codemirror/search'
import {startCompletion,closeCompletion} from '@codemirror/autocomplete'
import {lintGutter,linter,setDiagnostics,setDiagnosticsEffect} from '@codemirror/lint'
import {lintLatex,lintSupported,MAX_LINT_SOURCE,type LatexIssue,type ReferenceCatalog} from './latexDiagnostics'
import type {PaperCompileDiagnostic} from '@/api/papers'
import {latexExtensionsFor} from './latexLanguage'
import type {LatexFile,LatexSymbol} from './latexSymbols'
import {paperAIReplacement,type PaperAIEdit,type PaperAISourceRange} from './aiSuggestion'
import {UndoManager,type Text as YText} from 'yjs'
import {yCollab,ySyncFacet,ySyncAnnotation} from 'y-codemirror.next'
import {remoteCursorDecorations,type CollaborationPeer,type LocalSelection} from './paperPresence'

const props = defineProps<{ modelValue: string; readonly?: boolean; citations?: readonly string[]; filePath?:string; completionFiles?:readonly LatexFile[]; projectSymbols?:(refresh:boolean)=>readonly LatexSymbol[]|Promise<readonly LatexSymbol[]>; checkProjectReferences?:()=>Promise<ReferenceCatalog>; compileDiagnostics?:readonly PaperCompileDiagnostic[]; collaborativeText?: YText; remotePeers?: readonly CollaborationPeer[]; canEditCollaboration?:()=>boolean }>()
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
const supportsLint=computed(()=>lintSupported(props.filePath))
type DisplayIssue=LatexIssue&{line:number}
const lintRows=shallowRef<DisplayIssue[]>([]),lintOpen=ref(false),lintPending=ref(false),lintSkipped=ref(false),lintTruncated=ref(false)
const projectCatalog=shallowRef<ReferenceCatalog|null>(null),projectLintBusy=ref(false),projectLintMessage=ref('')
const lintStatus=computed(()=>lintPending.value?'正在检查源码…':lintSkipped.value?'本地检查已暂停':lintRows.value.length?lintRows.value.length+' 个源码问题':'源码检查 · 无已发现问题')
let lintTimer:ReturnType<typeof setTimeout>|null=null,lintSerial=0,lintDisposed=false
function lintFence(){
 return JSON.stringify([props.filePath||'',(props.completionFiles||[]).filter(f=>f.path!==props.filePath).map(f=>[f.id,f.path,f.kind,f.revision,f.sha256]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))])
}
function clearLintTimer(){if(lintTimer!==null){clearTimeout(lintTimer);lintTimer=null}}
function runLint(){
 clearLintTimer()
 const view=editor
 if(!view||lintDisposed)return
 const doc=view.state.doc
 const source=doc.length<=MAX_LINT_SOURCE?doc.toString():null
 const result=source===null?{issues:[],skipped:true,truncated:false}:lintLatex(source,{path:props.filePath,files:props.completionFiles,catalog:projectCatalog.value})
 const rows:LatexIssue[]=[...result.issues]
 // Compile diagnostics are authorized and revision-fenced by the workspace.
 // Never re-use a server line after the local buffer has changed.
 if(supportsLint.value&&!props.collaborativeText&&source!==null&&source===props.modelValue){
  for(const row of (props.compileDiagnostics||[]).slice(0,12)){
   if(row.file!==props.filePath||!Number.isSafeInteger(row.line)||!row.line||row.line<1||row.line>doc.lines)continue
   const line=doc.line(row.line)
   rows.push({code:'compiled-error',from:line.from,to:line.to,severity:'error',message:row.message,source:'编译错误'})
  }
 }
 rows.sort((a,b)=>a.from-b.from||a.to-b.to)
 lintRows.value=rows.map(row=>({...row,line:doc.lineAt(row.from).number}))
 lintSkipped.value=result.skipped;lintTruncated.value=result.truncated;lintPending.value=false
 view.dispatch(setDiagnostics(view.state,rows))
}
function scheduleLint(){
 if(!editor||lintDisposed)return
 clearLintTimer();lintRows.value=[];lintPending.value=supportsLint.value
 lintTimer=setTimeout(runLint,420)
}
function invalidateLint(){
 if(!editor||lintDisposed)return
 editor.dispatch(setDiagnostics(editor.state,[]))
 scheduleLint()
}
function jumpLint(row:DisplayIssue){
 if(!editor||lintPending.value||!lintRows.value.includes(row))return
 editor.dispatch({selection:{anchor:row.from,head:row.to},effects:EditorView.scrollIntoView(row.from,{y:'center'})})
 editor.focus()
}
async function checkReferences(){
 const check=props.checkProjectReferences
 if(!check||projectLintBusy.value||props.readonly||lintDisposed)return
 const initial=lintFence(),n=++lintSerial
 const valid=()=>!lintDisposed&&n===lintSerial&&initial===lintFence()&&check===props.checkProjectReferences
 projectLintBusy.value=true;projectLintMessage.value='正在读取项目内已保存的引用定义…'
 projectCatalog.value=null;invalidateLint()
 try{
  const catalog=await check()
  if(!valid())return
  projectCatalog.value=catalog
  projectLintMessage.value=catalog.truncated?'静态索引达到容量限制，暂不判断缺失的跨文件引用。':'项目静态引用已检查；未找到的定义仅作提示，宏生成或外部引用可能仍然有效。'
  runLint()
 }catch{
  if(valid()){projectCatalog.value=null;projectLintMessage.value='未能读取完整且一致的项目版本，请保存或刷新后重试。';runLint()}
 }finally{if(valid())projectLintBusy.value=false}
}
watch(lintFence,()=>{
 lintSerial++;projectCatalog.value=null;projectLintBusy.value=false;projectLintMessage.value=''
 invalidateLint()
},{flush:'post'})
watch(()=>props.compileDiagnostics,invalidateLint,{flush:'post'})
watch(()=>props.checkProjectReferences,()=>{
 lintSerial++;projectCatalog.value=null;projectLintBusy.value=false;projectLintMessage.value=''
 invalidateLint()
},{flush:'post'})

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
        linter(null),...(supportsLint.value?[lintGutter()]:[]),
        // Clear old ranges in the same transaction as a source change.
        EditorState.transactionExtender.of(tr=>tr.docChanged?{effects:setDiagnosticsEffect.of([])}:null),
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
        ...latexExtensionsFor({citations:()=>props.citations||[],files:()=>props.completionFiles||[],path:()=>props.filePath||'',projectSymbols:refresh=>props.projectSymbols?.(refresh)||[]}),
        EditorView.lineWrapping,
        readonlyCompartment.of([EditorState.readOnly.of(Boolean(props.readonly)),EditorView.editable.of(!props.readonly)]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !applyingExternalValue && !props.collaborativeText) emit('update:modelValue', update.state.doc.toString())
          if(update.docChanged)scheduleLint()
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
  runLint()
})

watch([()=>props.remotePeers,()=>props.modelValue],updateRemoteCursors,{flush:'post'})

watch(()=>props.readonly,value=>{
  if(value&&editor)closeCompletion(editor)
  editor?.dispatch({effects:readonlyCompartment.reconfigure([EditorState.readOnly.of(Boolean(value)),EditorView.editable.of(!value)])})
})

watch(()=>props.completionFiles?.filter(f=>f.path!==props.filePath).map(f=>[f.id,f.path,f.kind,f.revision,f.sha256].join(':')).join('|'),()=>{
 if(editor)closeCompletion(editor)
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
  lintDisposed=true;lintSerial++;clearLintTimer();projectCatalog.value=null
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
.latex-editor-lint-count{font-variant-numeric:tabular-nums;font-size:11px}
.lint-error{color:var(--a-color-danger,#b91c1c)}
.lint-warning{color:var(--a-color-text-secondary,#a16207)}
.latex-lint-panel{max-height:min(180px,35%);overflow:auto;flex-shrink:0;display:flex;flex-direction:column;gap:4px;padding:5px 7px;border-top:1px solid var(--a-color-border-soft,#ddd);font-size:11px;background:var(--a-color-bg,#fff)}
.latex-lint-panel__heading{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.latex-lint-panel__heading strong{margin-right:auto}
.latex-lint-panel p,.latex-lint-panel small{margin:0;line-height:1.45;color:var(--a-color-text-secondary,#64748b);overflow-wrap:anywhere}
.latex-lint-panel__rows{display:grid;gap:2px}
.latex-lint-panel__row{display:flex;align-items:flex-start;justify-content:flex-start;white-space:normal;height:auto;gap:5px;background:transparent;border:0;border-bottom:1px solid var(--a-color-border-soft,#eee);padding:4px;text-align:left;color:inherit;cursor:pointer;min-width:0;font:inherit}
.latex-lint-panel__row:hover{background:var(--a-color-bg-soft,#f1f3f5)}
.latex-lint-panel__row svg{flex:none;margin-top:2px}
.latex-lint-panel__row>span{display:grid;gap:2px;min-width:0;overflow-wrap:anywhere}
.papers-latex-editor :deep(.cm-gutter-lint){width:14px}
.papers-latex-editor :deep(.cm-tooltip-lint){max-width:min(330px,90vw);overflow-wrap:anywhere;font-size:12px}
</style>
