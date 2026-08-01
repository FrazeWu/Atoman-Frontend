import { describe, expect, it } from 'vitest'

import { useApi } from '@/composables/useApi'
import { moduleRoutes } from '@/router/routes/modules'
import { buildAppRoutes } from '@/router/buildAppRoutes'

describe('short note routes and API contracts', () => {
  it('maps the short-note pages inside the blog module', () => {
    const blogRoot = moduleRoutes.blog.find((route) => route.path === '/')
    const routes = blogRoot?.children ?? []
    const blogPaths = routes.map((route) => route.path)

    expect(blogPaths).toEqual(expect.arrayContaining(['notes', 'notes/:id', 'notes/:id/edit']))
    expect(blogPaths).not.toContain('notes/new')

    for (const path of ['notes', 'notes/:id', 'notes/:id/edit']) {
      expect(routes.find((route) => route.path === path)?.component).toBeTruthy()
    }
  })

  it('exposes short note API endpoints', () => {
    const api = useApi()

    expect(api.blog.shortNotes).toContain('/short-notes')
    expect(api.blog.shortNote('note-1')).toContain('/short-notes/note-1')
    expect(api.blog.shortNoteLike('note-1')).toContain('/short-notes/note-1/like')
    expect(api.interactions.shortNoteComments('note-1')).toContain('/discussions/short_note/note-1/comments')
  })

  it('redirects the legacy short-note path to the blog module', () => {
    expect(buildAppRoutes().find((route) => route.path === '/notes')?.redirect).toBe('/posts/notes')
  })
})
