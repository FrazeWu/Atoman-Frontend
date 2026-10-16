import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { formatBookQuoteCitation, useDraftStagingStore } from '@/stores/draftStaging'

describe('draftStaging store and formatters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('formats markdown blockquote for blog post correctly with note and author', () => {
    const formatted = formatBookQuoteCitation({
      target: 'blog_post',
      quoteText: '生命是一袭华美的袍，爬满了蚤子。',
      bookTitle: '天才梦',
      bookAuthor: '张爱玲',
      personalNote: '经典譬喻，意味深长。',
    })
    expect(formatted).toContain('> 生命是一袭华美的袍，爬满了蚤子。')
    expect(formatted).toContain('> ——《天才梦》 · 张爱玲')
    expect(formatted).toContain('经典譬喻，意味深长。')
  })

  it('formats markdown blockquote for blog post without personal note', () => {
    const formatted = formatBookQuoteCitation({
      target: 'blog_post',
      quoteText: '生命是一袭华美的袍，爬满了蚤子。',
      bookTitle: '天才梦',
    })
    expect(formatted).toContain('> 生命是一袭华美的袍，爬满了蚤子。')
    expect(formatted).toContain('> ——《天才梦》')
    expect(formatted.endsWith('> ——《天才梦》')).toBe(true)
  })

  it('formats plain citation for short note correctly with note', () => {
    const formatted = formatBookQuoteCitation({
      target: 'short_note',
      quoteText: '人类的悲欢并不相通。',
      bookTitle: '而已集',
      personalNote: '夜深忽梦少年事。',
    })
    expect(formatted).toBe('夜深忽梦少年事。\n\n「人类的悲欢并不相通。」——《而已集》')
  })

  it('formats plain citation for short note without note', () => {
    const formatted = formatBookQuoteCitation({
      target: 'short_note',
      quoteText: '人类的悲欢并不相通。',
      bookTitle: '而已集',
    })
    expect(formatted).toBe('「人类的悲欢并不相通。」——《而已集》')
  })

  it('stores, consumes, and clears pending quote', () => {
    const store = useDraftStagingStore()
    expect(store.pendingQuote).toBeNull()

    store.setPendingQuote({
      sourceType: 'book_annotation',
      annotationId: 'anno-1',
      assetId: 'asset-1',
      bookTitle: '测试书籍',
      quoteText: '精彩语句',
      target: 'blog_post',
      mode: 'append',
    })

    expect(store.pendingQuote?.quoteText).toBe('精彩语句')

    // Mismatched target cannot consume
    const consumedMismatch = store.consumePendingQuote('short_note')
    expect(consumedMismatch).toBeNull()
    expect(store.pendingQuote).not.toBeNull()

    // Matching target consumes and clears
    const consumed = store.consumePendingQuote('blog_post')
    expect(consumed?.quoteText).toBe('精彩语句')
    expect(store.pendingQuote).toBeNull()
  })

  it('clears pending quote explicitly', () => {
    const store = useDraftStagingStore()
    store.setPendingQuote({
      sourceType: 'book_annotation',
      annotationId: 'anno-2',
      assetId: 'asset-2',
      bookTitle: '测试书籍2',
      quoteText: '另一句',
      target: 'short_note',
      mode: 'replace',
    })
    expect(store.pendingQuote).not.toBeNull()
    store.clearPendingQuote()
    expect(store.pendingQuote).toBeNull()
  })
})
