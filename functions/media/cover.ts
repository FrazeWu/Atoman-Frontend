type CoverProxyContext = {
  request: Request
}

const COVER_HOST = 'assets.atoman.org'

function resolveCoverUrl(request: Request): URL | null {
  const value = new URL(request.url).searchParams.get('url')?.trim()
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== COVER_HOST || url.port || url.username || url.password) {
      return null
    }
    return url
  } catch {
    return null
  }
}

export async function onRequestGet(context: CoverProxyContext) {
  const coverUrl = resolveCoverUrl(context.request)
  if (!coverUrl) return new Response('Invalid cover URL', { status: 400 })

  try {
    const response = await fetch(coverUrl, {
      headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg' },
      redirect: 'manual',
    })
    const contentType = response.headers.get('content-type') || ''
    if (!response.ok || !contentType.toLowerCase().startsWith('image/')) {
      return new Response('Cover unavailable', { status: 502 })
    }

    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': response.headers.get('cache-control') || 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    })
    const contentLength = response.headers.get('content-length')
    const etag = response.headers.get('etag')
    if (contentLength) headers.set('Content-Length', contentLength)
    if (etag) headers.set('ETag', etag)

    return new Response(response.body, { status: 200, headers })
  } catch {
    return new Response('Cover unavailable', { status: 502 })
  }
}
