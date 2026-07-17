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

export async function onRequest(context: ArticleContext) {
  const shell = await context.next()
  const fallback = shell.clone()
  const id = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id
  if (!id) return shell

  try {
    const requestUrl = new URL(context.request.url)
    const apiBase = resolveApiBase(context.env.VITE_API_URL, requestUrl.origin)
    const response = await fetch(`${apiBase}/blog/seo/posts/${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return shell

    const payload = await response.json() as { data?: BlogSeoPost }
    if (!isBlogSeoPost(payload.data)) return shell
    const html = buildArticleHtml(await shell.text(), payload.data, requestUrl.origin)
    const headers = new Headers(shell.headers)
    headers.set('content-type', 'text/html; charset=UTF-8')
    headers.delete('content-length')
    headers.delete('content-encoding')
    return new Response(html, { status: shell.status, statusText: shell.statusText, headers })
  } catch {
    return fallback
  }
}
