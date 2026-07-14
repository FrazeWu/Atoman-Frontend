import { describe, expect, it, vi } from 'vitest'

import { createMentionInput, normalizeCommentContent, searchMentionUsers, toMentionRange } from '@/composables/useCommentMentions'

describe('comment mentions', () => {
  it('converts UTF-16 textarea offsets to Unicode code-point offsets', () => {
    expect(toMentionRange('😀你好 @阿明', 5, 8)).toEqual({ start: 4, end: 7 })
    expect(() => toMentionRange('😀 @a', 1, 4)).toThrow()
    expect(() => toMentionRange('no mention', 0, 2)).toThrow()
  })

  it('normalizes NFC and requires ranges from normalized content', () => {
    expect(normalizeCommentContent('e\u0301\r\n@明')).toBe('é\n@明')
    expect(() => toMentionRange('e\u0301 @明', 3, 5)).toThrow()
    expect(createMentionInput({ uuid: 'u1', username: 'ming', display_name: '明', avatar_url: '', role: 'user' }, { start: 2, end: 4 })).toEqual({
      user_id: 'u1', start: 2, end: 4,
    })
  })

  it('searches active mention users with bounded limit', async () => {
    const request = vi.fn().mockResolvedValue([{ uuid: 'u1', username: 'ming', display_name: '', avatar_url: '', role: 'user' }])
    await expect(searchMentionUsers('阿明', 99, request)).resolves.toHaveLength(1)
    expect(request).toHaveBeenCalledWith('/api/v1/users/search?scope=mention&q=%E9%98%BF%E6%98%8E&limit=20')
  })
})
