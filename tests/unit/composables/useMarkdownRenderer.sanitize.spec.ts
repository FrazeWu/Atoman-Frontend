import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'

describe('useMarkdownRenderer sanitize', () => {
  it('filters dangerous inline event handlers from rendered html', () => {
    const { renderMarkdown } = useMarkdownRenderer()

    const html = renderMarkdown('<img src="x" onerror="alert(1)"><script>alert(1)</script>')

    expect(html).not.toContain('onerror=')
    expect(html).not.toContain('<script')
    expect(html).toContain('<img')
  })

  it('uses registered detail routes for unresolved post and music embeds', () => {
    const { renderMarkdown } = useMarkdownRenderer()
    const postID = '11111111-1111-1111-1111-111111111111'
    const albumID = '22222222-2222-2222-2222-222222222222'
    const videoID = '33333333-3333-3333-3333-333333333333'
    const html = renderMarkdown(`:::post{id="${postID}"}\n:::\n:::music{id="${albumID}"}\n:::\n:::video{id="${videoID}"}\n:::`)

    expect(html).toContain(`/posts/post/${postID}`)
    expect(html).toContain(`/music/album/${albumID}`)
    expect(html).toContain(`/videos/watch/${videoID}`)
  })
})
