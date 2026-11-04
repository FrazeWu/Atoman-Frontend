import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  WidgetType,
} from '@codemirror/view'
import {
  RangeSetBuilder,
  StateField,
  type Text,
  type EditorState,
  type Extension,
} from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

export function markdownTableCells(line: string) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((cell) => cell.trim())
}

export function markdownTableDOM(source: string) {
  const lines = source.split('\n').filter((line) => line.trim())
  if (lines.length < 2) return null
  const headers = markdownTableCells(lines[0])
  const dividers = markdownTableCells(lines[1])
  if (headers.length !== dividers.length || !dividers.every((cell) => /^:?-+:?$/.test(cell))) return null

  const table = document.createElement('table')
  const head = document.createElement('thead')
  const headRow = document.createElement('tr')
  const body = document.createElement('tbody')
  const alignments = dividers.map((divider) => {
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
  lines.slice(2).forEach((line) => {
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

export class MarkdownPreviewWidget extends WidgetType {
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
    wrapper.addEventListener('click', (event) => {
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

export function findClosingLine(doc: Text, startLine: number, marker: string) {
  for (let lineNumber = startLine + 1; lineNumber <= doc.lines; lineNumber += 1) {
    if (doc.line(lineNumber).text.trim() === marker) return lineNumber
  }
  return null
}

export function findTableEndLine(doc: Text, startLine: number) {
  let endLine = startLine + 1
  for (let lineNumber = startLine + 2; lineNumber <= doc.lines; lineNumber += 1) {
    if (!/^\s*\|/.test(doc.line(lineNumber).text)) break
    endLine = lineNumber
  }
  return endLine
}

export function buildLivePreviewDecos(view: EditorView, renderMarkdown: (source: string) => string): DecorationSet {
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

export function buildBlockPreviewDecos(state: EditorState, renderMarkdown: (source: string) => string): DecorationSet {
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
    const singleLineEmbed = /^:::(post|music|video)\{[^}\n]*\}\s*:::$/u.test(trimmed)
    if (singleLineEmbed) {
      addRange(line.from, line.to)
      continue
    }
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

export function makeBlockPreviewField(renderMarkdown: (source: string) => string) {
  return StateField.define<DecorationSet>({
    create: (state) => buildBlockPreviewDecos(state, renderMarkdown),
    update: (decorations, transaction) => (
      transaction.docChanged || transaction.selection
        ? buildBlockPreviewDecos(transaction.state, renderMarkdown)
        : decorations
    ),
    provide: (field) => EditorView.decorations.from(field),
  })
}

export function makeLivePreviewPlugin(renderMarkdown: (source: string) => string) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = buildLivePreviewDecos(view, renderMarkdown)
      }

      update(update: { docChanged: boolean; selectionSet: boolean; viewportChanged: boolean; view: EditorView }) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildLivePreviewDecos(update.view, renderMarkdown)
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  )
}

export function createLivePreviewExtensions(renderMarkdown: (source: string) => string): Extension[] {
  return [makeLivePreviewPlugin(renderMarkdown), makeBlockPreviewField(renderMarkdown)]
}
