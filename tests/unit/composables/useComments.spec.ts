import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { CommentApiClient, CommentDTO, CommentRootList, CommentTargetRef } from '@/api/comments'
import { useComments } from '@/composables/useComments'

const user = { id: 'u1', username: 'alice', display_name: 'Alice', avatar_url: '' }
const comment = (id: string, overrides: Partial<CommentDTO> = {}): CommentDTO => ({
  id, author_id: user.id, author: user, content: id, rendered_html: `<p>${id}</p>`, status: 'visible',
  like_count: 0, reply_count: 0, hot_score: 0, created_at: '2026-01-01T00:00:00Z', marked: false,
  liked: false, mentions: [], attachments: [], time_anchors: [], replies: [], ...overrides,
})
const roots = (items: CommentDTO[], target: CommentTargetRef, page = 1, totalRoots = items.length): CommentRootList => ({
  items, page, per_page: 20, total_roots: totalRoots, total_comments: items.length, total_replies: 0,
  target: { ...target, mark_label: '置顶', can_mark: true, comment_count: items.length, root_count: items.length },
})
const client = (overrides: Partial<CommentApiClient> = {}) => ({
  listRoots: vi.fn(), listReplies: vi.fn(), create: vi.fn(), edit: vi.fn(), delete: vi.fn(), uploadImage: vi.fn(),
  like: vi.fn(), unlike: vi.fn(), report: vi.fn(), mark: vi.fn(), unmark: vi.fn(), listReports: vi.fn(), moderate: vi.fn(),
  ...overrides,
}) as CommentApiClient

describe('useComments', () => {
  it('keeps backend order and merges load-more roots by id', async () => {
    const target = ref<CommentTargetRef>({ kind: 'blog_post', resource_id: 'post-1' })
    const api = client({ listRoots: vi.fn()
      .mockResolvedValueOnce(roots([comment('marked', { marked: true }), comment('a'), comment('a')], target.value, 1, 21))
      .mockResolvedValueOnce(roots([comment('a'), comment('b'), comment('b')], target.value, 2, 21)) })
    const state = useComments(target, api)
    await state.load(true)
    await state.loadMore()
    expect(state.roots.value.map(({ id }) => id)).toEqual(['marked', 'a', 'b'])
    expect(state.page.value).toBe(2)
  })

  it('does not let an old target request overwrite a new target', async () => {
    let resolveOld!: (value: CommentRootList) => void
    const old = new Promise<CommentRootList>((resolve) => { resolveOld = resolve })
    const target = ref<CommentTargetRef>({ kind: 'blog_post', resource_id: 'old' })
    const api = client({ listRoots: vi.fn().mockReturnValueOnce(old).mockResolvedValueOnce(roots([comment('new')], { kind: 'video', resource_id: 'new' })) })
    const state = useComments(target, api)
    const oldLoad = state.load(true)
    target.value = { kind: 'video', resource_id: 'new' }
    await state.load(true)
    resolveOld(roots([comment('old')], { kind: 'blog_post', resource_id: 'old' }))
    await oldLoad
    expect(state.roots.value.map(({ id }) => id)).toEqual(['new'])
  })

  it('merges and sorts expanded replies into one child array', async () => {
    const root = comment('root', { replies: [comment('child-2', { root_id: 'root', created_at: '2026-01-02T00:00:00Z' })] })
    const api = client({
      listRoots: vi.fn().mockResolvedValue(roots([root], { kind: 'forum_topic', resource_id: 'topic' })),
      listReplies: vi.fn().mockResolvedValue({
        items: [comment('child-1', { root_id: 'root', created_at: '2026-01-01T00:00:00Z' }), root.replies[0]],
        page: 1, per_page: 20, total: 2, has_more: false,
      }),
    })
    const state = useComments(ref({ kind: 'forum_topic', resource_id: 'topic' }), api)
    await state.load(true)
    await state.expandReplies('root')
    expect(state.roots.value[0]!.replies.map(({ id }) => id)).toEqual(['child-1', 'child-2'])
    expect(state.replyState('root')).toMatchObject({ expanded: true, page: 1, hasMore: false })
  })

  it('updates child mutations without creating a third level and deletes by level', async () => {
    const root = comment('root')
    const child = comment('child', { root_id: 'root', reply_to_id: 'other' })
    const api = client({
      listRoots: vi.fn().mockResolvedValue(roots([root], { kind: 'blog_post', resource_id: 'post' })),
      create: vi.fn().mockResolvedValue(child), delete: vi.fn().mockResolvedValue({ ok: true }),
    })
    const state = useComments(ref({ kind: 'blog_post', resource_id: 'post' }), api)
    await state.load(true)
    await state.create({ content: '@x', reply_to_id: 'other', mentions: [], attachment_ids: [] })
    expect(state.roots.value[0]!.replies).toEqual([child])
    await state.remove('child')
    expect(state.roots.value).toHaveLength(1)
    await state.remove('root')
    expect(state.roots.value).toHaveLength(0)
  })

  it('optimistically likes once and rolls back the exact original values on failure', async () => {
    let reject!: (reason: unknown) => void
    const pending = new Promise<never>((_, fail) => { reject = fail })
    const api = client({
      listRoots: vi.fn().mockResolvedValue(roots([comment('root', { liked: false, like_count: 4 })], { kind: 'blog_post', resource_id: 'post' })),
      like: vi.fn().mockReturnValue(pending),
    })
    const state = useComments(ref({ kind: 'blog_post', resource_id: 'post' }), api)
    await state.load(true)
    const first = state.toggleLike('root')
    const second = state.toggleLike('root')
    expect(api.like).toHaveBeenCalledTimes(1)
    expect(state.isLikePending('root').value).toBe(true)
    expect(state.roots.value[0]).toMatchObject({ liked: true, like_count: 5 })
    reject(new Error('offline'))
    await expect(first).rejects.toThrow('offline')
    await second
    expect(state.roots.value[0]).toMatchObject({ liked: false, like_count: 4 })
    expect(state.isLikePending('root').value).toBe(false)
  })
})
