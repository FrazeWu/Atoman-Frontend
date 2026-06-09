import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'

describe('useMarkdownRenderer sanitize', () => {
  it('filters dangerous inline event handlers from rendered html', () => {
    const { renderMarkdown } = useMarkdownRenderer()

    const html = renderMarkdown('<img src="x" onerror="alert(1)"><script>alert(1)</script>')

    expect(html).not.toContain('onerror=')
    expect(html).not.toContain('<script')
    expect(html).toContain('<img')
  })
})
