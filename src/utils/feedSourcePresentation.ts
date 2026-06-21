function trimLeadingWww(hostname: string): string {
  return hostname.replace(/^www\./i, '')
}

function parseSourceUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    if (!/^[^/?#]+\.[^/?#]+(?:[/?#]|$)/.test(value)) return null

    try {
      return new URL(`https://${value}`)
    } catch {
      return null
    }
  }
}

export function normalizeSourceUrlForCard(url?: string, fallbackTitle?: string): string {
  const value = url?.trim()
  if (!value) return fallbackTitle?.trim() ?? ''

  const parsed = parseSourceUrl(value)
  if (!parsed) return value

  const pathname = parsed.pathname === '/' ? '' : parsed.pathname
  return `${trimLeadingWww(parsed.hostname)}${pathname}${parsed.search}`
}

export function buildSourceAvatarLabel(title?: string): string {
  const value = title?.trim()
  if (!value) return '?'
  return value[0].toUpperCase()
}

export function buildSourceColor(seed?: string): string {
  const value = seed?.trim() || 'feed-source'
  let hash = 0

  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360
  }

  return `hsl(${hash} 62% 52%)`
}
