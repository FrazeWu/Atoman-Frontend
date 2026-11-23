import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  formatBookQuoteCitation,
  formatDiscussionQuote,
  useDraftStagingStore,
} from '@/stores/draftStaging'

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

  it('formats feed_article citations across all four targets with bounded short_note and clean debate title', () => {
    const token = '@article:01900000-0000-7000-8000-000000000123'
    const longQuote = '长摘录'.repeat(260)

    const shortNote = formatDiscussionQuote({
      sourceType: 'feed_article',
      target: 'short_note',
      mode: 'replace',
      title: `标题不应保留 ${token}`,
      sourceName: '技术周刊',
      quoteText: longQuote,
      referenceToken: token,
    })
    expect(Array.from(shortNote.content).length).toBeLessThanOrEqual(500)
    expect(shortNote.content).toContain(token)

    const debate = formatDiscussionQuote({
      sourceType: 'feed_article',
      target: 'debate',
      mode: 'replace',
      title: `带符号标题 ${token}`,
      sourceName: '技术周刊',
      author: '李四',
      quoteText: '关键论点摘录',
      referenceToken: token,
    })
    expect(debate.title).not.toContain(token)
    expect(debate.title).toContain('带符号标题')
    expect(debate.content).toContain('> 关键论点摘录')
    expect(debate.content).toContain(`背景材料：${token}`)

    const forum = formatDiscussionQuote({
      sourceType: 'blog_post',
      target: 'forum',
      mode: 'replace',
      title: '一篇长文',
      quoteText: '摘录段落',
      referenceToken: '@post:01900000-0000-7000-8000-000000000456',
    })
    expect(forum.title).toContain('关于「一篇长文」的讨论')
    expect(forum.content).toContain('参考来源：@post:01900000-0000-7000-8000-000000000456')

    const bookDebate = formatDiscussionQuote({
      sourceType: 'book_annotation',
      target: 'debate',
      mode: 'replace',
      title: '沙丘',
      bookTitle: '沙丘',
      bookAuthor: '赫伯特',
      quoteText: '恐惧是思维的杀手。',
    })
    expect(bookDebate.title).toContain('《沙丘》中的观点是否成立？')
    expect(bookDebate.content).not.toContain('@highlight:')
  })
})
