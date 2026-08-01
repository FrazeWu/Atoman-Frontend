const localObjectStorageHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0'])

export function resolveMediaURL(url: string) {
  if (!import.meta.env.DEV) return url

  try {
    const parsed = new URL(url)
    if (parsed.port !== '9100' || !localObjectStorageHosts.has(parsed.hostname)) return url
    return `/__object-storage${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return url
  }
}
