export function safeExternalUrl(value?: string | null): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes('\\') || /[\u0000-\u001F\u007F]/.test(trimmed)) return undefined
  try {
    const parsed = new URL(trimmed, typeof window === 'undefined' ? 'http://localhost' : window.location.origin)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? trimmed : undefined
  } catch {
    return undefined
  }
}
