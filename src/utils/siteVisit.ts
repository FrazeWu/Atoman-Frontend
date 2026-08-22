const VISITOR_ID_KEY = 'atoman_visitor_id'

export function getSiteVisitorId(): string {
  if (typeof window === 'undefined') return ''

  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY)?.trim()
    if (existing) return existing

    const generated = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(VISITOR_ID_KEY, generated)
    return generated
  } catch {
    return ''
  }
}
