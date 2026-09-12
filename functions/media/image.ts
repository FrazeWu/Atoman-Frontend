type ImageProxyContext = {
  request: Request
}

type ImageTransform = {
  width: number
  height?: number
  fit?: 'cover' | 'contain' | 'scale-down'
  quality?: number
  format: 'auto'
}

type CloudflareImageRequestInit = RequestInit & {
  cf?: {
    image: ImageTransform
  }
}

const ASSET_HOST = 'assets.atoman.org'
const IMAGE_ACCEPT = 'image/avif,image/webp,image/png,image/jpeg'

function resolveImageUrl(request: Request) {
  const value = new URL(request.url).searchParams.get('url')?.trim()
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== ASSET_HOST || url.port || url.username || url.password) {
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
    format: 'auto',
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

  const response = await fetch(imageUrl, {
    headers: { Accept: IMAGE_ACCEPT },
    redirect: 'manual',
    cf: { image: transform },
  } as CloudflareImageRequestInit)

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
