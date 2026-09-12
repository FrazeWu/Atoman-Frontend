const localObjectStorageHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0'])
const publicAssetHost = 'assets.atoman.org'

export type MediaImageOptions = {
  width: number
  height?: number
  fit?: 'cover' | 'contain' | 'scale-down'
  quality?: number
}

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

export function resolveMediaImageURL(url: string, options: MediaImageOptions) {
  const resolved = resolveMediaURL(url)
  if (!import.meta.env.PROD || !options.width) return resolved

  try {
    const parsed = new URL(resolved)
    if (parsed.protocol !== 'https:' || parsed.hostname !== publicAssetHost) return resolved

    const params = new URLSearchParams({
      url: parsed.toString(),
      width: String(Math.round(options.width)),
    })
    if (options.height) params.set('height', String(Math.round(options.height)))
    if (options.fit) params.set('fit', options.fit)
    if (options.quality) params.set('quality', String(Math.round(options.quality)))
    return `/media/image?${params.toString()}`
  } catch {
    return resolved
  }
}

export function resolveUploadedMediaURL(url: string, apiURL = '') {
  if (!url.startsWith('/uploads/')) return url
  if (!apiURL.startsWith('http://') && !apiURL.startsWith('https://')) return url

  try {
    return `${new URL(apiURL).origin}${url}`
  } catch {
    return url
  }
}

export function resolvePlayableAudioURL(url: string, apiURL = '') {
  const resolved = resolveUploadedMediaURL(resolveMediaURL(url), apiURL)

  try {
    const parsed = new URL(resolved)
    if (parsed.hostname !== 'assets.atoman.org') return resolved
    parsed.searchParams.set('cors', '1')
    return parsed.toString()
  } catch {
    return resolved
  }
}
