import { buildArticleHtml, resolveApiBase, type BlogSeoPost } from '../../_lib/blogSeo'

type ArticleContext = {
  request: Request
  env: { VITE_API_URL?: string }
  params: { id?: string | string[] }
  next: () => Promise<Response>
}

function isBlogSeoPost(value: unknown): value is BlogSeoPost {
  if (!value || typeof value !== 'object') return false
  const post = value as Partial<BlogSeoPost>
  return typeof post.id === 'string' && post.id.length > 0
    && typeof post.title === 'string'
    && typeof post.description === 'string'
    && typeof post.image_url === 'string'
    && typeof post.author_name === 'string'
    && (post.published_at === null || typeof post.published_at === 'string')
    && typeof post.updated_at === 'string'
    && typeof post.path === 'string'
}

function unavailableArticleResponse() {
  return new Response(
    '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="robots" content="noindex, nofollow"><title>文章不可用 | Atoman</title></head><body></body></html>',
    {
      status: 404,
      headers: {
        'content-type': 'text/html; charset=UTF-8',
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex, nofollow',
      },
    },
  )
}

export async function onRequest(context: ArticleContext) {
  const shell = await context.next()
  const fallback = shell.clone()
  const id = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id
  if (!id) return shell

  try {
    const requestUrl = new URL(context.request.url)
    const apiBase = resolveApiBase(context.env.VITE_API_URL, requestUrl.origin)
    const response = await fetch(`${apiBase}/blog/seo/posts/${encodeURIComponent(id)}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Atoman-Edge-SSR/1.0 (+https://www.atoman.org)',
      },
      signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(4000) : undefined,
    })
    if (!response.ok) {
      if (response.status === 404) return unavailableArticleResponse()
      return shell
    }

    const payload = await response.json() as { data?: BlogSeoPost }
    if (!isBlogSeoPost(payload.data)) return fallback
    const html = buildArticleHtml(await shell.text(), payload.data, requestUrl.origin)
    const headers = new Headers(shell.headers)
    headers.set('content-type', 'text/html; charset=UTF-8')
    headers.set('x-atoman-seo', 'hit')
    headers.delete('content-length')
    headers.delete('content-encoding')
    return new Response(html, { status: 200, statusText: 'OK', headers })
  } catch {
    return fallback
  }
}
