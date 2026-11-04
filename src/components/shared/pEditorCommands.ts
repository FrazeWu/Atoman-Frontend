import type { EditorView } from '@codemirror/view'
import { undo, redo } from '@codemirror/commands'
import type { PostEditorCommand } from '@/components/blog/postEditorCommands'

export function getCmSelection(cmView: EditorView | null): { from: number; to: number; selectedText: string } {
  if (!cmView) return { from: 0, to: 0, selectedText: '' }
  const { from, to } = cmView.state.selection.main
  const selectedText = cmView.state.sliceDoc(from, to)
  return { from, to, selectedText }
}

export function cmInsert(
  cmView: EditorView | null,
  from: number,
  to: number,
  text: string,
  cursorFrom?: number,
  cursorTo?: number,
) {
  if (!cmView) return
  cmView.dispatch({
    changes: { from, to, insert: text },
    selection: cursorFrom !== undefined
      ? { anchor: cursorFrom, head: cursorTo ?? cursorFrom }
      : undefined,
  })
  cmView.focus()
}

export function sv_wrap(
  cmView: EditorView | null,
  before: string,
  after: string,
  placeholder: string,
) {
  const { from, to, selectedText } = getCmSelection(cmView)
  const inserted = selectedText || placeholder
  const newText = before + inserted + after
  cmInsert(cmView, from, to, newText, from + before.length, from + before.length + inserted.length)
}

export function sv_wrapLinePrefix(
  cmView: EditorView | null,
  prefix: string,
  placeholder: string,
) {
  if (!cmView) return
  const { from, to } = getCmSelection(cmView)
  const firstLine = cmView.state.doc.lineAt(from)
  const endPosition = to > from && to === cmView.state.doc.lineAt(to).from ? to - 1 : to
  const lastLine = cmView.state.doc.lineAt(Math.max(from, endPosition))
  const original = cmView.state.sliceDoc(firstLine.from, lastLine.to)
  const lines = original.split('\n')
  const shouldRemove = lines.every((line) => !line.trim() || line.startsWith(prefix))
  const replacement = lines.map((line) => {
    if (!line.trim()) return shouldRemove ? '' : `${prefix}${placeholder}`
    if (shouldRemove) return line.startsWith(prefix) ? line.slice(prefix.length) : line
    if (/^#{1,6}\s+$/.test(prefix) && /^#{1,6}\s+/.test(line)) {
      return `${prefix}${line.replace(/^#{1,6}\s+/, '')}`
    }
    return `${prefix}${line}`
  }).join('\n')
  cmInsert(cmView, firstLine.from, lastLine.to, replacement, firstLine.from, firstLine.from + replacement.length)
}

export function sv_insertLink(cmView: EditorView | null) {
  const { from, to, selectedText } = getCmSelection(cmView)
  const text = selectedText || '链接文字'
  const md = `[${text}](url)`
  cmInsert(cmView, from, to, md, from + 1, from + 1 + text.length)
}

export function sv_insertTable(cmView: EditorView | null) {
  const { from } = getCmSelection(cmView)
  const table = '\n| 标题 | 标题 | 标题 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n'
  cmInsert(cmView, from, from, table)
}

export function sv_insertHr(cmView: EditorView | null) {
  const { from } = getCmSelection(cmView)
  cmInsert(cmView, from, from, '\n---\n')
}

export function sv_insertCodeBlock(cmView: EditorView | null) {
  const { from, to, selectedText } = getCmSelection(cmView)
  const body = selectedText || '代码'
  const newText = `\n\`\`\`txt\n${body}\n\`\`\`\n`
  const bodyStart = from + '\n```txt\n'.length
  cmInsert(cmView, from, to, newText, bodyStart, bodyStart + body.length)
}

export function sv_insertMath(cmView: EditorView | null) {
  const { from, to, selectedText } = getCmSelection(cmView)
  const body = selectedText || '公式'
  const markdown = `\n$$\n${body}\n$$\n`
  const bodyStart = from + '\n$$\n'.length
  cmInsert(cmView, from, to, markdown, bodyStart, bodyStart + body.length)
}

export function sv_undo(cmView: EditorView | null) {
  if (!cmView) return
  undo({ state: cmView.state, dispatch: cmView.dispatch.bind(cmView) })
  cmView.focus()
}

export function sv_redo(cmView: EditorView | null) {
  if (!cmView) return
  redo({ state: cmView.state, dispatch: cmView.dispatch.bind(cmView) })
  cmView.focus()
}

export interface PEditorCommandCallbacks {
  triggerImageUpload: () => void
  insertEmbed: (kind: 'post' | 'music' | 'video') => void
  insertReference: () => void
}

export function executeEditorCommand(
  cmView: EditorView | null,
  command: PostEditorCommand,
  callbacks: PEditorCommandCallbacks,
) {
  switch (command) {
    case 'undo': sv_undo(cmView); break
    case 'redo': sv_redo(cmView); break
    case 'heading2': sv_wrapLinePrefix(cmView, '## ', '标题'); break
    case 'heading3': sv_wrapLinePrefix(cmView, '### ', '标题'); break
    case 'heading4': sv_wrapLinePrefix(cmView, '#### ', '标题'); break
    case 'bold': sv_wrap(cmView, '**', '**', '粗体文字'); break
    case 'italic': sv_wrap(cmView, '*', '*', '斜体文字'); break
    case 'strike': sv_wrap(cmView, '~~', '~~', '删除线'); break
    case 'blockquote': sv_wrapLinePrefix(cmView, '> ', '引用内容'); break
    case 'bulletList': sv_wrapLinePrefix(cmView, '- ', '列表项'); break
    case 'orderedList': sv_wrapLinePrefix(cmView, '1. ', '列表项'); break
    case 'link': sv_insertLink(cmView); break
    case 'image': callbacks.triggerImageUpload(); break
    case 'table': sv_insertTable(cmView); break
    case 'codeBlock': sv_insertCodeBlock(cmView); break
    case 'horizontalRule': sv_insertHr(cmView); break
    case 'math': sv_insertMath(cmView); break
    case 'postEmbed': callbacks.insertEmbed('post'); break
    case 'musicEmbed': callbacks.insertEmbed('music'); break
    case 'videoEmbed': callbacks.insertEmbed('video'); break
    case 'reference': callbacks.insertReference(); break
  }
}
