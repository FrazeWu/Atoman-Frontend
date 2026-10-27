import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('PDF reader compatibility', () => {
  for (const file of ['src/components/books/BookPublicReaderView.vue', 'src/views/books/BookReaderView.vue']) {
    it(`${file} uses matching compatibility library and worker`, () => {
      const source = readFileSync(path.resolve(process.cwd(), file), 'utf8')
      expect(source).toContain("from 'pdfjs-dist/legacy/build/pdf.mjs'")
      expect(source).toContain("from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url'")
      expect(source).not.toContain("from 'pdfjs-dist'")
    })
  }
})
