type ImageProxyContext = {
  request: Request
}

type ImageTransform = {
  width: number
  height?: number
  fit?: 'cover' | 'contain' | 'scale-down'
  quality?: number
  format: 'webp'
}

type CloudflareImageRequestInit = RequestInit & {
  cf?: {
    image: ImageTransform
  }
}

const IMAGE_SOURCE_HOSTS = new Set([
  'assets.atoman.org',
  'covers.openlibrary.org',
  'is1-ssl.mzstatic.com',
  'lh3.googleusercontent.com',
  'blogger.googleusercontent.com',
  'www.designmadeingermany.de',
])
const IMAGE_ACCEPT = 'image/avif,image/webp,image/png,image/jpeg'

function resolveImageUrl(request: Request) {
  const value = new URL(request.url).searchParams.get('url')?.trim()
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !IMAGE_SOURCE_HOSTS.has(url.hostname) || url.port || url.username || url.password) {
      return null
    }
    return url
  } catch {
    return null
  }
}

function positiveInteger(value: string | null, fallback?: number) {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1600) return undefined
  return parsed
}

function imageTransform(request: Request): ImageTransform | null {
  const params = new URL(request.url).searchParams
  const width = positiveInteger(params.get('width'))
  const height = positiveInteger(params.get('height'))
  const quality = positiveInteger(params.get('quality'), 75)
  const fit = params.get('fit') || undefined

  if (!width || quality === undefined || (fit && !['cover', 'contain', 'scale-down'].includes(fit))) return null

  return {
    width,
    ...(height ? { height } : {}),
    ...(fit ? { fit: fit as ImageTransform['fit'] } : {}),
    quality,
    format: 'webp',
  }
}

function isImageResponse(response: Response) {
  const contentType = response.headers.get('content-type') || ''
  return response.ok && contentType.toLowerCase().startsWith('image/')
}

export async function onRequestGet(context: ImageProxyContext) {
  const imageUrl = resolveImageUrl(context.request)
  const transform = imageTransform(context.request)
  if (!imageUrl || !transform) return new Response('Invalid image request', { status: 400 })

  let source = imageUrl
  let response: Response
  for (let redirects = 0; ; redirects++) {
    response = await fetch(source, {
      headers: { Accept: IMAGE_ACCEPT },
      redirect: 'manual',
      cf: { image: transform },
    } as CloudflareImageRequestInit)
    if (![301, 302, 303, 307, 308].includes(response.status)) break
    const location = response.headers.get('location')
    if (imageUrl.hostname !== 'covers.openlibrary.org' || redirects >= 3 || !location) {
      return new Response('Image unavailable', { status: 502 })
    }
    // Open Library 的封面存储在 Archive.org，只跟随其 HTTPS 跳转。
    const next = new URL(location, source)
    if (next.protocol !== 'https:' || next.port || next.username || next.password ||
      !(next.hostname === 'covers.openlibrary.org' || next.hostname === 'archive.org' || next.hostname.endsWith('.archive.org'))) {
      return new Response('Image unavailable', { status: 502 })
    }
    source = next
  }

  if (!isImageResponse(response)) return new Response('Image unavailable', { status: 502 })

  const responseHeaders = new Headers({
    'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Vary': 'Accept',
    'X-Content-Type-Options': 'nosniff',
  })
  const etag = response.headers.get('etag')
  if (etag) responseHeaders.set('ETag', etag)

  return new Response(response.body, { status: 200, headers: responseHeaders })
}
