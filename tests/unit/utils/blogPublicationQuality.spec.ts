import { describe, expect, it } from 'vitest'

import { evaluateBlogPublicationQuality } from '@/utils/blogPublicationQuality'

describe('evaluateBlogPublicationQuality', () => {
  it('reports actionable non-blocking warnings for an incomplete post', () => {
    const warnings = evaluateBlogPublicationQuality({
      title: '文章标题',
      summary: '',
      coverUrl: '',
      content: '短文 ![](https://example.test/image.png)',
    })

    expect(warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining([
      'missing_summary',
      'missing_cover',
      'short_content',
      'missing_sections',
      'missing_image_alt',
    ]))
  })

  it('accepts a structured article with descriptive images', () => {
    const warnings = evaluateBlogPublicationQuality({
      title: '完整文章',
      summary: '文章摘要',
      coverUrl: 'https://example.test/cover.png',
      content: `## 背景\n\n${'内容 '.repeat(120)}\n\n![架构图](https://example.test/diagram.png)`,
    })

    expect(warnings).toEqual([])
  })
})
