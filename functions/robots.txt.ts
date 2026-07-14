import { buildRobotsText } from './_lib/blogSeo'

export function onRequest(context: { request: Request }) {
  const origin = new URL(context.request.url).origin
  return new Response(buildRobotsText(origin), {
    headers: { 'content-type': 'text/plain; charset=UTF-8' },
  })
}
