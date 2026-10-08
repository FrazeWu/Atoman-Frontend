import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import { feedArticleRouteState, type FeedArticleRouteState } from '@/composables/feed/feedArticleRouteState'

describe('Feed 文章路由状态', () => {
  it('将包含嵌套响应式对象的文章保存为浏览器可克隆的快照', () => {
    const state = reactive({
      article: { type: 'feed_item', feed_item: { id: 'saved-1', title: '收藏文章' } },
      articles: [],
      source: { id: 'source-1', title: '来源', type: 'external_rss' },
      sourceArticles: [],
    }) as unknown as FeedArticleRouteState
    const snapshot = feedArticleRouteState(state)
    expect(() => structuredClone(snapshot)).not.toThrow()
    state.article.feed_item!.title = '修改后的标题'
    expect((snapshot.feedArticleBrowser as unknown as FeedArticleRouteState).article.feed_item!.title).toBe('收藏文章')
  })
})
