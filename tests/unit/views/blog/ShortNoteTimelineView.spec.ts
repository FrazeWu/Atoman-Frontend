import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/views/blog/ShortNoteTimelineView.vue'), 'utf8')

describe('ShortNoteTimelineView', () => {
  it('provides an inline composer and prepends published notes', () => {
    expect(source).toContain('<ShortNoteComposer')
    expect(source).toContain('@submit="publish"')
    expect(source).toContain('notes.value.unshift(response.data)')
    expect(source).not.toContain('to="/posts/notes/new"')
  })
})
