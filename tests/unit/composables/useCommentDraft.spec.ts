import { describe, expect, it, vi } from 'vitest'

import { commentDraftKey, useCommentDraft } from '@/composables/useCommentDraft'

describe('useCommentDraft', () => {
  it('按评论目标和回复对象生成隔离 key，并保存清理本地草稿', () => {
    const target = { kind: 'video' as const, resourceId: 'video-1' }
    expect(commentDraftKey(target)).toBe('comment:video:video-1:root')
    expect(commentDraftKey(target, { replyToId: 'comment-1' })).toBe('comment:video:video-1:reply:comment-1')

    const drafts = useCommentDraft()
    const key = commentDraftKey(target)
    drafts.save(key, '草稿内容')
    expect(drafts.read(key)).toBe('草稿内容')
    drafts.clear(key)
    expect(drafts.read(key)).toBe('')
  })

  it('内容变化后防抖保存，并在 flush 时立即落盘', () => {
    vi.useFakeTimers()
    const drafts = useCommentDraft()
    const key = 'comment:video:video-1:root'
    drafts.schedule(key, '稍后保存')
    expect(drafts.read(key)).toBe('')
    vi.advanceTimersByTime(600)
    expect(drafts.read(key)).toBe('稍后保存')
    drafts.schedule(key, '立即保存')
    drafts.flush()
    expect(drafts.read(key)).toBe('立即保存')
    vi.useRealTimers()
  })
})
