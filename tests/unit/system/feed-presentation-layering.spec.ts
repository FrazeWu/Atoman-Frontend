import path from 'node:path'
import { readFileSync } from 'node:fs'

const read = (file: string) => readFileSync(path.resolve(process.cwd(), file), 'utf8')

describe('feed presentation layering', () => {
  it('keeps Hub tree loading in the Feed layout and presentation in the shared sidebar', () => {
    const layout = read('src/views/feed/FeedLayout.vue')
    expect(layout).toContain('feedStore.fetchSubscriptionHubTree()')
    expect(layout).toContain('<FeedMobileSourcesSheet')

    const sidebar = read('src/components/system/AppSidebar.vue')
    expect(sidebar).toContain("import SubscriptionHubSidebarTree from '@/components/feed/SubscriptionHubSidebarTree.vue'")
    expect(sidebar).toContain('<SubscriptionHubSidebarTree')
    expect(sidebar).not.toContain('FeedSidebarSources')
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
