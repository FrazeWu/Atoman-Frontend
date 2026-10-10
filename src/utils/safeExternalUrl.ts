export function safeExternalUrl(value?: string | null): string | undefined {
  if (!value) return undefined
  try {
    const parsed = new URL(value, typeof window === 'undefined' ? 'http://localhost' : window.location.origin)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? value : undefined
  } catch {
    return undefined
  }
}
