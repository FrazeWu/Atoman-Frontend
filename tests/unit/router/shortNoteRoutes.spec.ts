import { describe, expect, it } from 'vitest'

import { useApi } from '@/composables/useApi'
import { moduleRoutes } from '@/router/routes/modules'

describe('short note routes and API contracts', () => {
  it('maps the short-note pages inside the blog module', () => {
    const blogRoot = moduleRoutes.blog.find((route) => route.path === '/')
    const blogPaths = blogRoot?.children?.map((route) => route.path) ?? []

    expect(blogPaths).toEqual(expect.arrayContaining([
      'notes',
      'notes/new',
      'notes/:id',
      'notes/:id/edit',
    ]))
  })

  it('exposes short note API endpoints', () => {
    const api = useApi()

    expect(api.blog.shortNotes).toContain('/short-notes')
    expect(api.blog.shortNote('note-1')).toContain('/short-notes/note-1')
    expect(api.blog.shortNoteLike('note-1')).toContain('/short-notes/note-1/like')
    expect(api.interactions.shortNoteComments('note-1')).toContain('/discussions/short_note/note-1/comments')
  })
})
