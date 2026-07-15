import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiErrorResponseError } from '@/api/client'
import { commentApi, commentEndpoints } from '@/api/comments'

const ok = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status })

describe('comment API', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('token', 'comment-token')
    vi.restoreAllMocks()
  })

  it('encodes target paths, query and sends auth on anonymous GET endpoints', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ items: [] }))
    await commentApi.listRoots({ kind: 'blog/post' as never, resourceId: 'id with space' }, { sort: 'hot', page: 2, page_size: 20 })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/v1/discussions/blog%2Fpost/id%20with%20space/comments?sort=hot&page=2&page_size=20')
    expect(init).toMatchObject({ credentials: 'include' })
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer comment-token')
  })

  it('uses the backend methods and snake_case JSON bodies', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ ok: true }))
    await commentApi.mark({ kind: 'forum_topic', resourceId: 'topic' }, 'comment-1')
    expect(fetchMock).toHaveBeenCalledWith(commentEndpoints.mark('forum_topic', 'topic'), expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ comment_id: 'comment-1' }),
    }))
  })

  it('uploads comment images with purpose and returns the asset id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ id: 'asset-1', url: '/image' }, 201))
    await expect(commentApi.uploadImage(new File(['image'], 'x.png', { type: 'image/png' }))).resolves.toBe('asset-1')
    const [, init] = fetchMock.mock.calls[0]!
    expect(init?.body).toBeInstanceOf(FormData)
    expect((init?.body as FormData).get('purpose')).toBe('comment.image')
    expect((init?.headers as Record<string, string>)['Content-Type']).toBeUndefined()
  })

  it.each([401, 400])('preserves API error code for %s responses', async (status) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'comment.invalid_content', message: 'bad', details: { field: 'content' } },
    }), { status }))
    const error = await commentApi.create({ kind: 'blog_post', resourceId: 'post' }, {
      content: 'x', mentions: [], attachment_ids: [],
    }).catch((caught) => caught)
    expect(error).toBeInstanceOf(ApiErrorResponseError)
    expect(error).toMatchObject({ status, code: 'comment.invalid_content', details: { field: 'content' } })
  })
})
