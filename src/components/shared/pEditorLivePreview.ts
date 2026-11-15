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
      const codeBlockWrap = document.createElement('div')
      codeBlockWrap.className = 'cm-code-block-preview'

      const header = document.createElement('div')
      header.className = 'cm-code-block-header'

      const langSpan = document.createElement('span')
      langSpan.className = 'cm-code-block-lang'
      const language = fence[2].trim()
      langSpan.textContent = (language || 'code').toUpperCase()
      header.appendChild(langSpan)

      const editHint = document.createElement('span')
      editHint.className = 'cm-code-block-edit-hint'
      editHint.textContent = '点击编辑代码'
      header.appendChild(editHint)

      codeBlockWrap.appendChild(header)

      const pre = document.createElement('pre')
      const code = document.createElement('code')
      if (language) code.className = `hljs language-${language}`
      code.textContent = fence[3]
      pre.append(code)
      codeBlockWrap.append(pre)
      wrapper.append(codeBlockWrap)
    } else {
      const table = markdownTableDOM(this.source)
      if (table) {
        const tableWrap = document.createElement('div')
        tableWrap.className = 'cm-table-block-preview'

        const header = document.createElement('div')
        header.className = 'cm-table-block-header'

        const label = document.createElement('span')
        label.className = 'cm-table-block-label'
        label.textContent = '表格'
        header.appendChild(label)

        const editHint = document.createElement('span')
        editHint.className = 'cm-table-block-edit-hint'
        editHint.textContent = '点击编辑表格'
        header.appendChild(editHint)

        tableWrap.appendChild(header)
        tableWrap.appendChild(table)
        wrapper.append(tableWrap)
      } else {
        const isMath = /^\s*\$\$[\s\S]*\$\$\s*$/.test(this.source)
        if (isMath) {
          const mathWrap = document.createElement('div')
          mathWrap.className = 'cm-math-block-preview'

          const header = document.createElement('div')
          header.className = 'cm-math-block-header'

          const label = document.createElement('span')
          label.className = 'cm-math-block-label'
          label.textContent = '数学公式 (LATEX)'
          header.appendChild(label)

          const editHint = document.createElement('span')
          editHint.className = 'cm-math-block-edit-hint'
          editHint.textContent = '点击编辑公式'
          header.appendChild(editHint)

          mathWrap.appendChild(header)

          const template = document.createElement('template')
          template.innerHTML = this.html
          mathWrap.appendChild(template.content.cloneNode(true))
          wrapper.append(mathWrap)
        } else {
          const template = document.createElement('template')
          // renderMarkdown sanitizes through DOMPurify before widgets receive the HTML.
          template.innerHTML = this.html
          wrapper.append(template.content.cloneNode(true))
        }
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

const renderCache = new Map<string, string>()
function cachedRenderMarkdown(source: string, renderMarkdown: (source: string) => string): string {
  let html = renderCache.get(source)
  if (html === undefined) {
    html = renderMarkdown(source)
    if (renderCache.size >= 150) {
      const oldestKey = renderCache.keys().next().value
      if (oldestKey !== undefined) renderCache.delete(oldestKey)
    }
    renderCache.set(source, html)
  }
  return html
}

export function findBlockCandidateRanges(state: EditorState): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = []

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'FencedCode') return
      ranges.push({ from: node.from, to: node.to })
      return false
    },
  })

  const doc = state.doc
  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber)
    const trimmed = line.text.trim()
    const singleLineEmbed = /^:::(post|music|video)\{[^}\n]*\}\s*:::$/u.test(trimmed)
    if (singleLineEmbed) {
      ranges.push({ from: line.from, to: line.to })
      continue
    }
    if (trimmed === '$$' || /^:::(post|music|video)\{/.test(trimmed)) {
      const closingLine = findClosingLine(doc, lineNumber, trimmed === '$$' ? '$$' : ':::')
      if (closingLine) {
        ranges.push({ from: line.from, to: doc.line(closingLine).to })
        lineNumber = closingLine
      }
      continue
    }
    if (!/^\s*\|/.test(line.text) || lineNumber >= doc.lines) continue
    if (!/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(doc.line(lineNumber + 1).text)) continue
    const endLine = findTableEndLine(doc, lineNumber)
    ranges.push({ from: line.from, to: doc.line(endLine).to })
    lineNumber = endLine
  }
  return ranges
}

export function buildBlockPreviewDecos(state: EditorState, renderMarkdown: (source: string) => string): DecorationSet {
  const cursor = state.selection.main.head
  const candidateRanges = findBlockCandidateRanges(state)
  const ranges = candidateRanges.filter(range => cursor < range.from || cursor > range.to)

  ranges.sort((a, b) => a.from - b.from)
  const builder = new RangeSetBuilder<Decoration>()
  let lastTo = -1
  for (const range of ranges) {
    if (range.from < lastTo) continue
    const source = state.sliceDoc(range.from, range.to)
    builder.add(range.from, range.to, Decoration.replace({
      block: true,
      widget: new MarkdownPreviewWidget(
        cachedRenderMarkdown(source, renderMarkdown),
        range.from,
        source,
      ),
    }))
    lastTo = range.to
  }
  return builder.finish()
}

export function makeBlockPreviewField(renderMarkdown: (source: string) => string) {
  let cachedCandidateRanges: Array<{ from: number; to: number }> = []
  let candidateRangesDocVersion: EditorState['doc'] | null = null

  const getCandidateRanges = (state: EditorState) => {
    if (candidateRangesDocVersion === state.doc) return cachedCandidateRanges
    cachedCandidateRanges = findBlockCandidateRanges(state)
    candidateRangesDocVersion = state.doc
    return cachedCandidateRanges
  }

  const findBlockForPos = (pos: number, ranges: Array<{ from: number; to: number }>) => {
    return ranges.find((r) => pos >= r.from && pos <= r.to) || null
  }

  return StateField.define<DecorationSet>({
    create: (state) => buildBlockPreviewDecos(state, renderMarkdown),
    update: (decorations, transaction) => {
      if (transaction.docChanged) {
        return buildBlockPreviewDecos(transaction.state, renderMarkdown)
      }
      if (transaction.selection) {
        const ranges = getCandidateRanges(transaction.state)
        const prevHead = transaction.startState.selection.main.head
        const newHead = transaction.state.selection.main.head
        const prevBlock = findBlockForPos(prevHead, ranges)
        const newBlock = findBlockForPos(newHead, ranges)
        if (prevBlock === newBlock) {
          return decorations
        }
        return buildBlockPreviewDecos(transaction.state, renderMarkdown)
      }
      return decorations
    },
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
