import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import type { ResolvedReference } from '@/api/references'

describe('useMarkdownRenderer sanitize', () => {
  it('filters dangerous inline event handlers from rendered html', () => {
    const { renderMarkdown } = useMarkdownRenderer()

    const html = renderMarkdown('<img src="x" onerror="alert(1)"><script>alert(1)</script>')

    expect(html).not.toContain('onerror=')
    expect(html).not.toContain('<script')
    expect(html).toContain('<img')
  })

  it('renders resolved reference tokens as internal links', () => {
    const { renderMarkdown, renderMarkdownInline } = useMarkdownRenderer()
    const references: ResolvedReference[] = [{
      kind: 'resource', target_type: 'thread', target_id: 'topic-1', field: 'content',
      start: 0, end: 13, label: '讨论主题', module: 'forum', path: '/topic/topic-1', available: true,
    }]
    const html = renderMarkdown('@thread:topic', { references })
    expect(html).toContain('href="/forum/topic/topic-1"')
    expect(html).toContain('@讨论主题')
    expect(renderMarkdownInline('@thread:topic', { references })).toBe('<a href="/forum/topic/topic-1">@讨论主题</a>')
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
