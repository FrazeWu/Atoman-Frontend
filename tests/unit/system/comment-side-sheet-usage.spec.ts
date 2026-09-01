import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const commentSideSheetHosts = [
  'src/components/blog/BlogPostSheet.vue',
  'src/components/blog/ShortNoteSheet.vue',
  'src/components/debate/DebateDiscussionSheet.vue',
  'src/components/feed/FeedArticleSheet.vue',
  'src/components/shortnote/ShortNoteCard.vue',
  'src/components/music/AlbumDrawer.vue',
  'src/views/blog/PostDetailView.vue',
  'src/views/books/BookWorkView.vue',
  'src/views/forum/ForumTopicView.vue',
  'src/views/podcast/PodcastEpisodeView.vue',
  'src/views/video/VideoDetailView.vue',
]

describe('Comment side sheet usage', () => {
  it.each(commentSideSheetHosts)('%s opens comments through CommentSideSheet', (file) => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8')

    expect(source).toContain('CommentSideSheet')
    expect(source).not.toContain('CommentSection')
  })

  it('keeps album discussions out of the generic nested-action drawer', () => {
    const albumSource = readFileSync(
      resolve(process.cwd(), 'src/components/music/AlbumDrawer.vue'),
      'utf8',
    )
    const actionSource = readFileSync(
      resolve(process.cwd(), 'src/components/music/NestedActionDrawer.vue'),
      'utf8',
    )

    expect(albumSource).not.toContain("openNestedAction('discussion'")
    expect(actionSource).not.toContain("currentAction === 'discussion'")
  })

  it('keeps short-note detail responsible only for its card, not an inline comment list', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/views/blog/ShortNoteDetailView.vue'),
      'utf8',
    )

    expect(source).toContain('ShortNoteCard')
    expect(source).not.toContain('CommentSection')
  })
})
