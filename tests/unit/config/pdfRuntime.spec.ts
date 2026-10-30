import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('PDF reader compatibility', () => {
  it('src/utils/bookReaderEngines.ts uses matching legacy compatibility library and worker', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/utils/bookReaderEngines.ts'), 'utf8')
    expect(source).toContain("'pdfjs-dist/legacy/build/pdf.mjs'")
    expect(source).toContain("'pdfjs-dist/legacy/build/pdf.worker.mjs?url'")
    expect(source).not.toContain("from 'pdfjs-dist'")
    expect(source).not.toContain("import('pdfjs-dist')")
  })

  for (const file of ['src/components/books/BookPublicReaderView.vue', 'src/views/books/BookReaderView.vue']) {
    it(`${file} uses matching compatibility types`, () => {
      const source = readFileSync(path.resolve(process.cwd(), file), 'utf8')
      expect(source).toContain("pdfjs-dist/legacy/build/pdf.mjs")
      expect(source).not.toContain("from 'pdfjs-dist'")
    })
  }
})
