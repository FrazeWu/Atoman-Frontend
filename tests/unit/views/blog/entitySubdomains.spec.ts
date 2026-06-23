import { describe, expect, it } from 'vitest'
import { resolveSiteContext } from '@/router/siteContext'

describe('entity path routing helpers', () => {
  it('parses explicit user paths as user entities', () => {
    expect(resolveSiteContext('www.atoman.org', '', '/users/alice')).toEqual({
      type: 'entity',
      handle: 'alice',
    })
  })

  it('parses explicit channel paths as channel entities', () => {
    expect(resolveSiteContext('www.atoman.org', '', '/channels/design')).toEqual({
      type: 'entity',
      handle: 'design',
    })
  })

  it('leaves unresolved top-level paths outside explicit entity path handling', () => {
    expect(resolveSiteContext('www.atoman.org', '', '/alice')).not.toEqual({ type: 'entity', handle: 'alice' })
    expect(resolveSiteContext('www.atoman.org', '', '/design')).not.toEqual({ type: 'entity', handle: 'design' })
  })
})
