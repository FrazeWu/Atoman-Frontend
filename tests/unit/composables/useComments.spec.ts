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
  target: { kind: target.kind, resource_id: target.resourceId, mark_label: '置顶', can_mark: true, comment_count: items.length, root_count: items.length },
})
const client = (overrides: Partial<CommentApiClient> = {}) => ({
  listRoots: vi.fn(), listReplies: vi.fn(), create: vi.fn(), edit: vi.fn(), delete: vi.fn(), uploadImage: vi.fn(),
  like: vi.fn(), unlike: vi.fn(), report: vi.fn(), mark: vi.fn(), unmark: vi.fn(), listReports: vi.fn(), moderate: vi.fn(),
  ...overrides,
}) as CommentApiClient

describe('useComments', () => {
  it('keeps backend order and merges load-more roots by id', async () => {
    const target = ref<CommentTargetRef>({ kind: 'blog_post', resourceId: 'post-1' })
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
    const target = ref<CommentTargetRef>({ kind: 'blog_post', resourceId: 'old' })
    const api = client({ listRoots: vi.fn().mockReturnValueOnce(old).mockResolvedValueOnce(roots([comment('new')], { kind: 'video', resourceId: 'new' })) })
    const state = useComments(target, api)
    const oldLoad = state.load(true)
    target.value = { kind: 'video', resourceId: 'new' }
    await state.load(true)
    resolveOld(roots([comment('old')], { kind: 'blog_post', resourceId: 'old' }))
    await oldLoad
    expect(state.roots.value.map(({ id }) => id)).toEqual(['new'])
  })

  it('does not roll back the new page when an old load-more request fails', async () => {
    let rejectMore!: (reason: unknown) => void
    const pendingMore = new Promise<CommentRootList>((_, reject) => { rejectMore = reject })
    const target = { kind: 'blog_post', resourceId: 'post' } as const
    const api = client({ listRoots: vi.fn()
      .mockResolvedValueOnce(roots([comment('oldest')], target, 1, 21))
      .mockReturnValueOnce(pendingMore)
      .mockResolvedValueOnce(roots([comment('newest')], target, 1, 1)) })
    const state = useComments(ref(target), api)
    await state.load()
    const loadMore = state.loadMore()
    await state.setSort('newest')
    rejectMore(new Error('stale page failed'))
    await expect(loadMore).rejects.toThrow('stale page failed')

    expect(state.page.value).toBe(1)
    expect(state.roots.value.map(({ id }) => id)).toEqual(['newest'])
  })

  it('merges and sorts expanded replies into one child array', async () => {
    const root = comment('root', { replies: [comment('child-2', { root_id: 'root', created_at: '2026-01-02T00:00:00Z' })] })
    const api = client({
      listRoots: vi.fn().mockResolvedValue(roots([root], { kind: 'forum_topic', resourceId: 'topic' })),
      listReplies: vi.fn().mockResolvedValue({
        items: [comment('child-1', { root_id: 'root', created_at: '2026-01-01T00:00:00Z' }), root.replies[0]],
        page: 1, per_page: 20, total: 2, has_more: false,
      }),
    })
    const state = useComments(ref({ kind: 'forum_topic', resourceId: 'topic' }), api)
    await state.load(true)
    await state.expandReplies('root')
    expect(state.roots.value[0]!.replies.map(({ id }) => id)).toEqual(['child-1', 'child-2'])
    expect(state.replyState('root')).toMatchObject({ expanded: true, page: 1, hasMore: false })
  })

  it('updates child mutations without creating a third level and deletes by level', async () => {
    const root = comment('root')
    const child = comment('child', { root_id: 'root', reply_to_id: 'other' })
    const api = client({
      listRoots: vi.fn().mockResolvedValueOnce(roots([root], { kind: 'blog_post', resourceId: 'post' }))
        .mockResolvedValueOnce(roots([], { kind: 'blog_post', resourceId: 'post' })),
      create: vi.fn().mockResolvedValue(child), delete: vi.fn().mockResolvedValue({ ok: true }),
    })
    const state = useComments(ref({ kind: 'blog_post', resourceId: 'post' }), api)
    await state.load(true)
    await state.create({ content: '@x', reply_to_id: 'other', mentions: [], attachment_ids: [] })
    expect(state.roots.value[0]!.replies).toEqual([child])
    expect(state.target.value?.comment_count).toBe(2)
    await state.remove('child')
    expect(state.roots.value).toHaveLength(1)
    expect(state.target.value?.comment_count).toBe(1)
    await state.remove('root')
    expect(state.roots.value).toHaveLength(0)
    expect(state.target.value).toMatchObject({ comment_count: 0, root_count: 0 })
  })

  it('keeps expanded replies and a new child when the root preview is already full', async () => {
    const target = { kind: 'blog_post', resourceId: 'post' } as const
    const preview = [1, 2, 3].map((index) => comment(`child-${index}`, {
      root_id: 'root', created_at: `2026-01-0${index}T00:00:00Z`,
    }))
    const expanded = [...preview, comment('child-4', { root_id: 'root', created_at: '2026-01-04T00:00:00Z' })]
    const freshRoot = () => comment('root', { reply_count: 4, replies: structuredClone(preview) })
    const created = comment('child-5', { root_id: 'root', created_at: '2026-01-05T00:00:00Z' })
    const api = client({
      listRoots: vi.fn().mockImplementation(() => Promise.resolve(roots([freshRoot()], target))),
      listReplies: vi.fn().mockResolvedValue({
        items: structuredClone(expanded), page: 1, per_page: 20, total: 4, has_more: false,
      }),
      create: vi.fn().mockResolvedValue(created),
    })
    const state = useComments(ref(target), api)
    await state.load()
    await state.expandReplies('root')
    await state.create({ content: 'new', reply_to_id: 'root', mentions: [], attachment_ids: [] })

    expect(api.listRoots).toHaveBeenCalledTimes(1)
    expect(state.roots.value[0]?.replies.map(({ id }) => id)).toEqual([
      'child-1', 'child-2', 'child-3', 'child-4', 'child-5',
    ])
    expect(state.roots.value[0]?.reply_count).toBe(5)
    expect(state.target.value?.comment_count).toBe(2)
    expect(state.replyState('root')).toMatchObject({ expanded: true, page: 1, hasMore: false })
  })

  it('ignores a late child creation after switching targets', async () => {
    let resolveCreate!: (value: CommentDTO) => void
    const pendingCreate = new Promise<CommentDTO>((resolve) => { resolveCreate = resolve })
    const target = ref<CommentTargetRef>({ kind: 'blog_post', resourceId: 'old' })
    const api = client({
      listRoots: vi.fn()
        .mockResolvedValueOnce(roots([comment('old-root')], target.value))
        .mockResolvedValueOnce(roots([comment('new-root')], { kind: 'video', resourceId: 'new' })),
      create: vi.fn().mockReturnValue(pendingCreate),
    })
    const state = useComments(target, api)
    await state.load()
    const creation = state.create({ content: 'late', reply_to_id: 'old-root', mentions: [], attachment_ids: [] })
    target.value = { kind: 'video', resourceId: 'new' }
    await state.load()
    resolveCreate(comment('late-child', { root_id: 'old-root' }))
    await creation

    expect(state.roots.value.map(({ id }) => id)).toEqual(['new-root'])
    expect(state.target.value).toMatchObject({ resource_id: 'new', comment_count: 1 })
  })

  it('ignores a late child deletion after switching targets', async () => {
    let resolveDelete!: (value: { ok: boolean }) => void
    const pendingDelete = new Promise<{ ok: boolean }>((resolve) => { resolveDelete = resolve })
    const oldChild = comment('old-child', { root_id: 'old-root' })
    const target = ref<CommentTargetRef>({ kind: 'blog_post', resourceId: 'old' })
    const api = client({
      listRoots: vi.fn()
        .mockResolvedValueOnce(roots([comment('old-root', { reply_count: 1, replies: [oldChild] })], target.value))
        .mockResolvedValueOnce(roots([comment('new-root')], { kind: 'video', resourceId: 'new' })),
      delete: vi.fn().mockReturnValue(pendingDelete),
    })
    const state = useComments(target, api)
    await state.load()
    const deletion = state.remove('old-child')
    target.value = { kind: 'video', resourceId: 'new' }
    await state.load()
    resolveDelete({ ok: true })
    await deletion

    expect(state.roots.value.map(({ id }) => id)).toEqual(['new-root'])
    expect(state.target.value).toMatchObject({ resource_id: 'new', comment_count: 1 })
  })

  it('optimistically likes once and rolls back the exact original values on failure', async () => {
    let reject!: (reason: unknown) => void
    const pending = new Promise<never>((_, fail) => { reject = fail })
    const api = client({
      listRoots: vi.fn().mockResolvedValue(roots([comment('root', { liked: false, like_count: 4 })], { kind: 'blog_post', resourceId: 'post' })),
      like: vi.fn().mockReturnValue(pending),
    })
    const state = useComments(ref({ kind: 'blog_post', resourceId: 'post' }), api)
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

  it('reloads after marking so the target summary and server ordering stay authoritative', async () => {
    const target = { kind: 'forum_topic', resourceId: 'topic' } as const
    const marked = comment('b', { marked: true })
    const api = client({
      listRoots: vi.fn()
        .mockResolvedValueOnce(roots([comment('a'), comment('b')], target))
        .mockResolvedValueOnce({ ...roots([marked, comment('a')], target), target: {
          kind: target.kind, resource_id: target.resourceId, mark_label: '最佳回答', can_mark: true,
          marked_comment_id: 'b', comment_count: 2, root_count: 2,
        } }),
      mark: vi.fn().mockResolvedValue({ ok: true }),
    })
    const state = useComments(ref(target), api)
    await state.load()
    await state.mark('b')
    expect(state.roots.value.map(({ id }) => id)).toEqual(['b', 'a'])
    expect(state.target.value?.marked_comment_id).toBe('b')
  })

  it('reloads page one after deleting from a full loaded page without skipping the shifted item', async () => {
    const target = { kind: 'blog_post', resourceId: 'post' } as const
    const firstPage = Array.from({ length: 20 }, (_, index) => comment(`root-${index + 1}`))
    const shiftedPage = [...firstPage.slice(1), comment('root-21')]
    const api = client({
      listRoots: vi.fn()
        .mockResolvedValueOnce(roots(firstPage, target, 1, 21))
        .mockResolvedValueOnce(roots(shiftedPage, target, 1, 20)),
      delete: vi.fn().mockResolvedValue({ ok: true }),
    })
    const state = useComments(ref(target), api)
    await state.load()
    await state.remove('root-1')
    expect(state.roots.value).toHaveLength(20)
    expect(state.roots.value.at(-1)?.id).toBe('root-21')
    expect(state.hasMore.value).toBe(false)
  })
})
