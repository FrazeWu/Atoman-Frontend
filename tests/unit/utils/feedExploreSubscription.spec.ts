import { describe, expect, it } from 'vitest'
import {
  feedExploreScrollKey,
  partitionUnsubscribedRecommendations,
  readExploreScroll,
  rememberExploreScroll,
} from '@/utils/feedExploreSubscription'

describe('explore subscription helpers', () => {
  it('splits unsubscribed external sources from internal channels', () => {
    expect(partitionUnsubscribedRecommendations([
      { id: 'rss-1', source_type: 'external_rss', subscribed: false },
      { id: 'rss-2', source_type: 'external_rss', subscribed: true },
      { id: 'chan-1', source_type: 'internal_channel', source_id: 'channel-real' },
      { id: 'chan-2', target_path: '/channels/chan-2' },
    ])).toEqual({
      externalIds: ['rss-1'],
      internalChannelIds: ['channel-real', 'chan-2'],
    })
  })

  it('remembers scroll for the current explore filters', () => {
    const stored = new Map<string, string>()
    const storage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    }
    const key = feedExploreScrollKey({ mode: 'featured', category: 'news', theme: 'ai', language: 'zh', page: 2 })
    expect(key).toContain('news')
    expect(key).not.toContain('subscribe_source')
    rememberExploreScroll(storage, key, 640.4)
    expect(readExploreScroll(storage, key)).toBe(640)
    rememberExploreScroll(storage, key, 0)
    expect(readExploreScroll(storage, key)).toBe(0)
  })
})
