import { describe, expect, it } from 'vitest'

import { applyResolvedReferences, referenceHref } from '@/composables/useReferenceRendering'
import type { ResolvedReference } from '@/api/references'

describe('reference rendering', () => {
  it('replaces Unicode code-point ranges with linked labels for the requested field', () => {
    const content = '前缀😀 @post:123 后缀'
    const token = '@post:123'
    const start = Array.from(content.slice(0, content.indexOf(token))).length
    const references: ResolvedReference[] = [{
      kind: 'resource', target_type: 'post', target_id: '123', field: 'content', start,
      end: start + Array.from(token).length, label: '文章标题', module: 'blog', path: '/post/123', available: true,
    }]

    expect(applyResolvedReferences(content, references, 'content')).toBe('前缀😀 [@文章标题](/posts/post/123) 后缀')
    expect(applyResolvedReferences(content, references, 'description')).toBe(content)
  })

  it('uses usernames for user mentions and preserves unavailable tokens', () => {
    const content = '@alice @post:missing'
    const references: ResolvedReference[] = [
      { kind: 'user', target_type: 'user', target_id: 'u1', field: 'content', start: 0, end: 6, label: 'Alice Zhang', subtitle: '@alice', module: 'blog', path: '/users/alice', available: true },
      { kind: 'resource', target_type: 'post', target_id: 'p1', field: 'content', start: 7, end: 20, available: false },
    ]

    expect(applyResolvedReferences(content, references)).toBe('[@alice](/users/alice) @post:missing')
  })

  it('resolves module-relative, already-prefixed, and global entity paths', () => {
    expect(referenceHref({ module: 'forum', path: '/topic/1' })).toBe('/forum/topic/1')
    expect(referenceHref({ module: 'video', path: '/videos/watch/1' })).toBe('/videos/watch/1')
    expect(referenceHref({ module: 'blog', path: '/users/alice' })).toBe('/users/alice')
  })
})
