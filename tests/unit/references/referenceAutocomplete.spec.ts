import { describe, expect, it } from 'vitest'

import {
  fitReferenceMenuPosition,
  insertReferenceTrigger,
  parseReferenceTrigger,
  referencePublishErrorMessage,
  referenceTokenForSuggestion,
  type ReferenceSuggestion,
} from '@/composables/useReferenceAutocomplete'

describe('reference autocomplete', () => {
  it('detects user and resource searches at the cursor', () => {
    expect(parseReferenceTrigger('hello @ali')).toMatchObject({ mode: 'root', query: 'ali', start: 6 })
    expect(parseReferenceTrigger('see @post:design system')).toMatchObject({ mode: 'resource', targetType: 'post', query: 'design system', start: 4 })
  })

  it('does not activate inside code, link destinations, or debate relation suffixes', () => {
    expect(parseReferenceTrigger('`@post:abc')).toBeNull()
    expect(parseReferenceTrigger('[label](@post:abc')).toBeNull()
    expect(parseReferenceTrigger('@debate:12345678-1234-1234-1234-123456789abc:support')).toBeNull()
    expect(parseReferenceTrigger('See @post:design\nnext line')).toBeNull()
  })

  it('builds canonical tokens for users, resources, and type choices', () => {
    const user: ReferenceSuggestion = {
      kind: 'target', key: 'user:1', targetType: 'user', id: '1', label: 'Alice', subtitle: '@alice', module: 'blog', path: '/users/alice', available: true,
    }
    const post: ReferenceSuggestion = {
      kind: 'target', key: 'post:2', targetType: 'post', id: '2', label: 'Post', module: 'blog', path: '/post/2', available: true,
    }
    const typeChoice: ReferenceSuggestion = { kind: 'type', key: 'type:post', targetType: 'post', label: '文章' }

    expect(referenceTokenForSuggestion(user)).toBe('@alice')
    expect(referenceTokenForSuggestion(post)).toBe('@post:2')
    expect(referenceTokenForSuggestion(typeChoice)).toBe('@post:')
  })

  it('keeps a fixed menu inside the viewport and opens upward near the bottom', () => {
    expect(fitReferenceMenuPosition(
      { left: 1000, top: 700, bottom: 720 },
      { width: 1024, height: 768 },
    )).toEqual({ left: 628, top: 408 })

    expect(fitReferenceMenuPosition(
      { left: 360, top: 100, bottom: 120 },
      { width: 375, height: 700 },
    )).toEqual({ left: 12, top: 124 })
  })

  it('inserts a valid root trigger at the current selection', () => {
    expect(insertReferenceTrigger('hello', 5, 5)).toEqual({
      value: 'hello @', cursor: 7, insert: ' @',
    })
    expect(insertReferenceTrigger('before selected after', 7, 15)).toEqual({
      value: 'before @ after', cursor: 8, insert: '@',
    })
  })

  it('maps reference publish failures to an actionable message', () => {
    const message = '请从候选中选择有效引用'
    expect(referencePublishErrorMessage({
      error: { code: 'reference.invalid_syntax', message: 'Reference syntax is invalid' },
    }, '发布失败')).toBe(message)
    expect(referencePublishErrorMessage({
      code: 'reference.invalid_target', message: 'Reference is unavailable',
    }, '发布失败')).toBe(message)
    expect(referencePublishErrorMessage({ code: 'system.internal_error' }, '发布失败')).toBe('发布失败')
  })
})
