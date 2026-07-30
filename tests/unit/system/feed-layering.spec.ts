import path from 'node:path'
import { readFileSync } from 'node:fs'

describe('FeedView layering', () => {
  it('delegates reusable UI structure to feed building blocks', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/views/feed/FeedView.vue'), 'utf8')

    expect(source).toContain('SubscriptionManageSheet')
    expect(source).toContain('SubscriptionAddSheet')
    expect(source).toContain('FeedArticleSheet')
    expect(source).toContain('FeedTimelineFooter')
  })

  it('delegates subscription management workflows to a composable', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/views/feed/FeedView.vue'), 'utf8')

    expect(source).toContain('useFeedSubscriptionManager({')
    for (const declaration of [
      'const createSubscriptionGroup = async',
      'const subscribeOnboardingRecommendations = async',
      'const syncAllSubscriptions = async',
      'const exportOPML = async',
      'const saveSubscriptionRule = async',
      'const updateAutomationRules =',
    ]) {
      expect(source).not.toContain(declaration)
    }
  })

  it('delegates timeline loading and routing workflows to a composable', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/views/feed/FeedView.vue'), 'utf8')

    expect(source).toContain('useFeedTimelineController({')
    for (const declaration of [
      'const fetchTimeline = async',
      'const checkTimelineUpdates = async',
      'const setPageInRoute = async',
      'const changePage = async',
      'const toggleAllRead = async',
    ]) {
      expect(source).not.toContain(declaration)
    }
  })

  it('delegates article reading and source browsing workflows to a composable', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/views/feed/FeedView.vue'), 'utf8')

    expect(source).toContain('useFeedArticleBrowser({')
    for (const declaration of [
      'const openArticleSheet =',
      'const fetchSourceArticles = async',
      'const postSource =',
      'const subscribeSelectedSource = async',
    ]) {
      expect(source).not.toContain(declaration)
    }
  })
})
