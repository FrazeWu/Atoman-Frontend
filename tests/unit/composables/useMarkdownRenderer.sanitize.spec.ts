import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'

describe('useMarkdownRenderer sanitize', () => {
  it('filters dangerous inline event handlers from rendered html', () => {
    const { renderMarkdown } = useMarkdownRenderer()

    const html = renderMarkdown('<img src="x" onerror="alert(1)"><script>alert(1)</script>')

    expect(html).not.toContain('onerror=')
    expect(html).not.toContain('<script')
    expect(html).toContain('<img')
  })

  it('renders scoped post and music embed fallback links', () => {
    const { renderMarkdown } = useMarkdownRenderer()
    const postId = '11111111-1111-1111-1111-111111111111'
    const albumId = '22222222-2222-2222-2222-222222222222'

    const html = renderMarkdown(`:::post{id="${postId}"}\n:::\n\n:::music{id="${albumId}"}\n:::`)

    expect(html).toContain(`href="/posts/post/${postId}"`)
    expect(html).toContain(`href="/music/album/${albumId}"`)
    expect(html).not.toContain(`href="/post/${postId}"`)
    expect(html).not.toContain(`href="/music/albums/${albumId}"`)
  })
})
