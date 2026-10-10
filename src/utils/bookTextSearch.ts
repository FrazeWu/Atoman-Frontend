export type BookTextSearchMatch = {
  index: number
  preview: string
}

function normalized(value: string) {
  return value.toLocaleLowerCase('zh-CN')
}

export function findBookTextMatches(text: string, query: string, limit = 50): BookTextSearchMatch[] {
  const trimmedQuery = query.trim()
  if (!trimmedQuery || !text || limit <= 0) return []

  const source = normalized(text)
  const target = normalized(trimmedQuery)
  const matches: BookTextSearchMatch[] = []
  let cursor = 0
  while (cursor < source.length && matches.length < limit) {
    const index = source.indexOf(target, cursor)
    if (index < 0) break
    const previewStart = Math.max(0, index - 36)
    const previewEnd = Math.min(text.length, index + trimmedQuery.length + 60)
    matches.push({
      index,
      preview: `${previewStart > 0 ? '…' : ''}${text.slice(previewStart, previewEnd).replace(/\s+/g, ' ').trim()}${previewEnd < text.length ? '…' : ''}`,
    })
    cursor = index + Math.max(1, target.length)
  }
  return matches
}
