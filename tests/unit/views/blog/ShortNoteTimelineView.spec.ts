import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/views/blog/ShortNoteTimelineView.vue'), 'utf8')

describe('ShortNoteTimelineView', () => {
  it('provides an inline composer and prepends published notes', () => {
    expect(source).toContain('<ShortNoteComposer')
    expect(source).toContain('@submit="publish"')
    expect(source).toContain('notes.value.unshift(response.data)')
    expect(source).toContain('composerKey.value += 1')
    expect(source).not.toContain('to="/posts/notes/new"')
  })

  it('uses loaded notes for a desktop-only secondary rail', () => {
    expect(source).toContain('class="short-note-timeline__layout"')
    expect(source).toContain('class="short-note-timeline__rail"')
    expect(source).toContain('热门短笺')
    expect(source).toContain('最新动态')
    expect(source).toContain('const hotNotes = computed')
    expect(source).toContain('type="button"')
    expect(source).toContain('blogSheets.openShortNote')
    expect(source).toContain('@media (max-width: 1024px)')
  })
})
