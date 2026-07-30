import path from 'node:path'
import { readFileSync } from 'node:fs'

const read = (file: string) => readFileSync(path.resolve(process.cwd(), file), 'utf8')

describe('feed presentation layering', () => {
  it('shares timeline-to-subscription matching across feed surfaces', () => {
    for (const file of [
      'src/views/feed/FeedLayout.vue',
      'src/components/system/AppSidebar.vue',
    ]) {
      const source = read(file)
      expect(source).toContain("import { findSubscriptionByTimelineItem } from '@/utils/feedSubscriptions'")
      expect(source).not.toContain('const findSubscriptionByTimelineItem =')
      expect(source).not.toContain('function findSubscriptionByTimelineItem(')
    }

    const presentation = read('src/composables/feed/useFeedTimelinePresentation.ts')
    expect(presentation).toContain("import { findSubscriptionByTimelineItem } from '@/utils/feedSubscriptions'")
  })

  it('delegates timeline filtering and display helpers to a composable', () => {
    const source = read('src/views/feed/FeedView.vue')

    expect(source).toContain('useFeedTimelinePresentation({')
    for (const implementationDetail of [
      'const visibleTimeline = computed(',
      'const extractThemesFromItem =',
      'const stripHtml =',
      'const toggleDuplicateSources =',
    ]) {
      expect(source).not.toContain(implementationDetail)
    }
  })
})
