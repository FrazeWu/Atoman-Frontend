import { describe, expect, it } from 'vitest'
import { marked } from 'marked'

import { commentCodePointLength, normalizeCommentMarkdown, renderCommentMarkdown, validateCommentMarkdown } from '@/composables/useCommentMarkdown'

describe('restricted comment Markdown', () => {
  it('allows only the supported markup and hardens links', () => {
    const result = renderCommentMarkdown('**粗体** *斜体* `代码`\n\n> 引用\n\n[链接](https://example.com)')
    expect(result.ok).toBe(true)
    expect(result.html).toContain('<strong>粗体</strong>')
    expect(result.html).toContain('rel="nofollow noreferrer noopener"')
    expect(result.html).not.toMatch(/<(?!\/?(?:p|br|strong|em|code|a|blockquote)\b)/)
  })

  it.each([
    '<b>raw</b>', '![x](https://x.test/x.png)', '- item', '# heading', '```js\nx\n```',
    '|a|b|\n|-|-|\n|1|2|', '~~gone~~', '[bad](javascript:alert(1))', '[relative](/path)',
  ])('rejects unsupported syntax: %s', (source) => {
    expect(validateCommentMarkdown(source).ok).toBe(false)
  })

  it('does not reject literal restricted markers inside code spans', () => {
    expect(validateCommentMarkdown('`~~x~~ | a |`').ok).toBe(true)
  })

  it('uses an isolated Marked instance and normalizes code points', () => {
    marked.use({ renderer: { strong: () => '<global>polluted</global>' } })
    expect(renderCommentMarkdown('**safe**').html).not.toContain('polluted')
    expect(normalizeCommentMarkdown('e\u0301\r\n')).toBe('é\n')
    expect(commentCodePointLength('😀a')).toBe(2)
  })
})
