export interface TextHighlightSegment {
  text: string
  match: boolean
}

/**
 * Splits text into segments marking matches with the given query tokens.
 * Matches are case-insensitive and whitespace-separated keywords are each matched.
 */
export function highlightSegments(text: string, query?: string): TextHighlightSegment[] {
  if (!text) return []
  if (!query) return [{ text, match: false }]

  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!tokens.length) return [{ text, match: false }]

  const tokenSet = new Set(tokens.map((t) => t.toLowerCase()))
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)

  return parts
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      match: tokenSet.has(part.toLowerCase()),
    }))
}
