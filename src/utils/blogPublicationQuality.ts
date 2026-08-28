export type BlogPublicationWarningCode =
  | 'missing_summary'
  | 'missing_cover'
  | 'short_content'
  | 'missing_sections'
  | 'missing_image_alt'

export interface BlogPublicationWarning {
  code: BlogPublicationWarningCode
  message: string
}

export interface BlogPublicationQualityInput {
  title: string
  summary: string
  coverUrl: string
  content: string
}

const minimumContentLength = 240

export function evaluateBlogPublicationQuality(
  input: BlogPublicationQualityInput,
): BlogPublicationWarning[] {
  const warnings: BlogPublicationWarning[] = []
  const content = input.content.trim()

  if (!input.summary.trim()) {
    warnings.push({
      code: 'missing_summary',
      message: '补充摘要，帮助读者在发现页判断文章主题。',
    })
  }
  if (!input.coverUrl.trim()) {
    warnings.push({
      code: 'missing_cover',
      message: '添加封面，帮助读者在内容流中识别文章。',
    })
  }
  if (content.length < minimumContentLength) {
    warnings.push({
      code: 'short_content',
      message: `正文少于 ${minimumContentLength} 个字符，请确认内容已完整。`,
    })
  }
  if (!/^#{2,}\s+\S+/m.test(content)) {
    warnings.push({
      code: 'missing_sections',
      message: '添加二级标题，让长文更容易浏览。',
    })
  }
  if (/!\[\s*\]\([^\s)]+(?:\s+[^)]*)?\)/.test(content)) {
    warnings.push({
      code: 'missing_image_alt',
      message: '为图片补充替代文本，方便读者和辅助技术理解内容。',
    })
  }

  return warnings
}
