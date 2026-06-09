import path from 'node:path'
import { readFileSync } from 'node:fs'

const mainSource = readFileSync(path.resolve(process.cwd(), 'src/main.ts'), 'utf8')
const markdownRendererSource = readFileSync(
  path.resolve(process.cwd(), 'src/composables/useMarkdownRenderer.ts'),
  'utf8',
)

describe('markdown renderer style loading', () => {
  it('keeps highlight and katex styles out of the global app entry', () => {
    expect(mainSource).not.toContain("import 'katex/dist/katex.min.css'")
    expect(mainSource).not.toContain("import 'highlight.js/styles/atom-one-dark.css'")

    expect(markdownRendererSource).not.toContain("import 'katex/dist/katex.min.css'")
    expect(markdownRendererSource).not.toContain("import 'highlight.js/styles/atom-one-dark.css'")

    expect(markdownRendererSource).toContain("import('katex/dist/katex.min.css')")
    expect(markdownRendererSource).toContain("import('highlight.js/styles/atom-one-dark.css')")
  })

  it('lazy-loads heavy markdown runtime dependencies', () => {
    expect(markdownRendererSource).not.toContain("import { markedHighlight } from 'marked-highlight'")
    expect(markdownRendererSource).not.toContain("import markedKatex from 'marked-katex-extension'")
    expect(markdownRendererSource).not.toContain("import hljs from 'highlight.js'")

    expect(markdownRendererSource).toContain("import('marked-highlight')")
    expect(markdownRendererSource).toContain("import('marked-katex-extension')")
    expect(markdownRendererSource).toContain("import('highlight.js')")
  })
})