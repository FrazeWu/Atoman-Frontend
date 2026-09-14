import { describe, expect, it } from 'vitest'

import { deferStylesheetLinks } from '../../../scripts/deferStylesheet'

describe('deferStylesheetLinks', () => {
  it('preloads the production stylesheet and keeps a no-script fallback', () => {
    const html = '<head><link rel="stylesheet" crossorigin href="/assets/index.css"></head>'

    const result = deferStylesheetLinks(html)

    expect(result).toContain('<link rel="preload" as="style" crossorigin href="/assets/index.css"')
    expect(result).toContain('onload="this.onload=null;this.rel=\'stylesheet\'"')
    expect(result).toContain('<noscript><link rel="stylesheet" crossorigin href="/assets/index.css"></noscript>')
  })

  it('leaves unrelated links unchanged', () => {
    const html = '<link rel="preconnect" href="https://assets.atoman.org">'

    expect(deferStylesheetLinks(html)).toBe(html)
  })
})
