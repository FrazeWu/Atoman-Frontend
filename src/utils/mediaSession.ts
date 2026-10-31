import { resolveMediaImageURL } from '@/utils/mediaUrl'

export const MEDIA_SESSION_ARTWORK_SIZES = [96, 128, 192, 256, 384, 512] as const

/**
 * 将相对路径/对象存储路径安全转换为绝对 URL (macOS / iOS 锁屏及控制中心必需)
 */
export function toAbsoluteMediaURL(url: string): string {
  if (!url || typeof url !== 'string') return ''
  if (/^(?:https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    if (url.startsWith('//') && typeof window !== 'undefined' && window.location?.protocol) {
      return `${window.location.protocol}${url}`
    }
    return url
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    try {
      return new URL(url, window.location.origin).href
    } catch {
      return url
    }
  }
  return url
}

/**
 * 根据文件名后缀推导 MIME 类型提示（无法确定时不返回，由系统嗅探）
 */
export function inferImageMimeType(url: string): string | undefined {
  try {
    const pathname = new URL(url, 'https://atoman.org').pathname.toLowerCase()
    if (pathname.endsWith('.png')) return 'image/png'
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg'
    if (pathname.endsWith('.webp')) return 'image/webp'
    if (pathname.endsWith('.avif')) return 'image/avif'
  } catch {
    // 忽略无法解析的 URL
  }
  return undefined
}

/**
 * 生成全规格高清 Artwork 列表
 */
export function buildMediaSessionArtwork(coverUrl?: string): MediaImage[] {
  const fallbackUrl = toAbsoluteMediaURL('/favicon.png')
  const baseCover = coverUrl ? toAbsoluteMediaURL(coverUrl) : fallbackUrl

  return MEDIA_SESSION_ARTWORK_SIZES.map((size) => {
    const dimension = `${size}x${size}`
    const src = coverUrl
      ? toAbsoluteMediaURL(resolveMediaImageURL(coverUrl, { width: size, height: size, fit: 'cover' }))
      : baseCover
    const type = inferImageMimeType(src)

    return type ? { src, sizes: dimension, type } : { src, sizes: dimension }
  })
}

/**
 * W3C 标准防御性校验位置状态，杜绝任何导致 TypeError 的异常参数
 */
export function sanitizeMediaPositionState(state?: {
  duration?: number
  position?: number
  playbackRate?: number
} | null): MediaPositionState | null {
  if (!state) return null

  const duration = Number(state.duration)
  const position = Number(state.position)
  let playbackRate = Number(state.playbackRate)

  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position) || position < 0) {
    return null
  }

  // W3C 明确规定 playbackRate 不得为 0
  if (!Number.isFinite(playbackRate) || playbackRate === 0) {
    playbackRate = 1.0
  }

  // 严防 position > duration 抛出 TypeError
  const safePosition = Math.min(position, duration)

  return {
    duration,
    playbackRate,
    position: safePosition,
  }
}
