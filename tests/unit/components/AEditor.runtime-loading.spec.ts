import path from 'node:path'
import { readFileSync } from 'node:fs'

const editorShellSource = readFileSync(
  path.resolve(process.cwd(), 'src/components/shared/AEditor.vue'),
  'utf8',
)

describe('AEditor runtime loading', () => {
  it('keeps the heavy editor runtime behind an async boundary', () => {
    expect(editorShellSource).not.toContain("from '@codemirror/view'")
    expect(editorShellSource).not.toContain("from '@codemirror/state'")
    expect(editorShellSource).not.toContain("from '@codemirror/commands'")
    expect(editorShellSource).not.toContain("from '@codemirror/lang-markdown'")
    expect(editorShellSource).not.toContain("from '@codemirror/language-data'")
    expect(editorShellSource).not.toContain("from '@codemirror/language'")
    expect(editorShellSource).not.toContain("from '@lezer/highlight'")
    expect(editorShellSource).not.toContain("from 'yjs'")
    expect(editorShellSource).not.toContain("from 'y-websocket'")
    expect(editorShellSource).not.toContain("from 'y-codemirror.next'")

    expect(editorShellSource).toContain("defineAsyncComponent")
    expect(editorShellSource).toContain("import('./AEditorRuntime.vue')")
  })
})