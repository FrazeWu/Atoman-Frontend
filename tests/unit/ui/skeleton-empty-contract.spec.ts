import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

describe('skeleton-empty-contract', () => {
  const targetViews = [
    'src/views/books/BooksDiscoverView.vue',
    'src/views/books/BookListsView.vue',
    'src/views/books/BookNotesView.vue',
    'src/views/feed/InboxPage.vue',
    'src/views/messages/MessagesWorkspaceView.vue',
    'src/views/search/SearchResultsView.vue',
    'src/views/timeline/TimelineHomeView.vue',
  ]

  it('ensures core views import and use PEmpty or PSkeleton instead of raw empty classes', () => {
    for (const viewPath of targetViews) {
      const fullPath = resolve(process.cwd(), viewPath)
      expect(existsSync(fullPath)).toBe(true)
      const content = readFileSync(fullPath, 'utf-8')

      // Must import PEmpty or PSkeleton or use them in template
      const usesPEmpty = content.includes('PEmpty')
      const usesPSkeleton = content.includes('PSkeleton')
      expect(usesPEmpty || usesPSkeleton).toBe(true)

      // Must not contain developer-facing crude text
      expect(content).not.toContain('暂无数据')
      expect(content).not.toContain('暂无满足门槛的图书')
    }
  })

  it('validates PSkeletonCard export and component structure', async () => {
    const PSkeletonCard = (await import('@/components/ui/PSkeletonCard.vue')).default
    expect(PSkeletonCard).toBeDefined()
  })
})
