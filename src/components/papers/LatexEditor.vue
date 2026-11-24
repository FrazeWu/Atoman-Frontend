<template>
  <div ref="editorRoot" class="papers-latex-editor" aria-label="LaTeX 源码编辑器" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'

const props = defineProps<{ modelValue: string; readonly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; 'show-pdf': []; 'cursor-line': [line:number] }>()
const editorRoot = ref<HTMLElement | null>(null)
let editor: EditorView | null = null
let applyingExternalValue = false

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
        keymap.of([{key:'Mod-Shift-j',run:()=>{emit('show-pdf');return true}}, ...defaultKeymap, ...historyKeymap]),
        EditorView.lineWrapping,
        EditorState.readOnly.of(Boolean(props.readonly)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !applyingExternalValue) emit('update:modelValue', update.state.doc.toString())
          if(update.selectionSet||update.docChanged)emit('cursor-line',update.state.doc.lineAt(update.state.selection.main.head).number)
        }),
      ],
    }),
  })
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
.papers-latex-editor { min-height: 0; height: 100%; overflow: hidden; background: var(--surface, #fff); }
.papers-latex-editor :deep(.cm-editor) { height: 100%; min-height: 0; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 13px; line-height: 1.65; }
.papers-latex-editor :deep(.cm-scroller) { overflow: auto; }
.papers-latex-editor :deep(.cm-gutters) { border-right: 1px solid var(--border, #e5e7eb); }
.papers-latex-editor :deep(.cm-focused) { outline: none; }
</style>
