import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { CommentApiClient, CommentDTO, CommentRootList } from '@/api/comments'
import { useComments } from '@/composables/useComments'

const root = (id: string): CommentDTO => ({
  id,
  author_id: 'author-1',
  author: { id: 'author-1', username: 'author', display_name: 'Author', avatar_url: '' },
  root_id: null,
  reply_to_id: null,
  reply_to_author: null,
  floor_number: 1,
  content: id,
  rendered_html: id,
  status: 'visible',
  edited_at: null,
  like_count: 0,
  reply_count: 0,
  hot_score: 0,
  created_at: '2026-01-01T00:00:00Z',
  marked: false,
  liked: false,
  mentions: [],
  references: [],
  attachments: [],
  time_anchors: [],
  replies: [],
})

const rootList = (resourceId: string, items: CommentDTO[]): CommentRootList => ({
  items,
  page: 1,
  per_page: 20,
  total_roots: items.length,
  total_comments: items.length,
  total_replies: 0,
  target: {
    kind: 'video',
    resource_id: resourceId,
    mark_label: 'Mark',
    can_mark: false,
    marked_comment_id: null,
    comment_count: items.length,
    root_count: items.length,
  },
})

function createClient(listRoots: ReturnType<typeof vi.fn>, listReplies = vi.fn()) {
  return {
    listRoots,
    listReplies,
    create: vi.fn(),
    edit: vi.fn(),
    delete: vi.fn(),
    uploadImage: vi.fn(),
    like: vi.fn(),
    unlike: vi.fn(),
    report: vi.fn(),
    mark: vi.fn(),
    unmark: vi.fn(),
    listReports: vi.fn(),
    moderate: vi.fn(),
  } as unknown as CommentApiClient
}

describe('useComments', () => {
  it('切换目标后加载失败时立即清空旧目标的展示状态', async () => {
    const target = ref({ kind: 'video' as const, resourceId: 'video-a' })
    const listRoots = vi.fn()
      .mockResolvedValueOnce(rootList('video-a', [root('root-a')]))
      .mockRejectedValueOnce(new Error('B failed'))
    const listReplies = vi.fn().mockResolvedValue({ items: [], page: 1, per_page: 20, total: 0, has_more: false })
    const comments = useComments(target, createClient(listRoots, listReplies))

    await comments.load(true)
    await comments.expandReplies('root-a')
    target.value = { kind: 'video', resourceId: 'video-b' }
    const loadB = comments.load(true)

    expect(comments.roots.value).toEqual([])
    expect(comments.target.value).toBeNull()
    expect(comments.page.value).toBe(0)
    expect(comments.hasMore.value).toBe(true)
    expect(comments.replyState('root-a').expanded).toBe(false)
    await expect(loadB).rejects.toThrow('B failed')
    expect(comments.roots.value).toEqual([])
    expect(comments.target.value).toBeNull()
  })

  it('同一目标排序刷新失败时保留已展示的评论', async () => {
    const target = ref({ kind: 'video' as const, resourceId: 'video-a' })
    const listRoots = vi.fn()
      .mockResolvedValueOnce(rootList('video-a', [root('root-a')]))
      .mockRejectedValueOnce(new Error('refresh failed'))
    const comments = useComments(target, createClient(listRoots))

    await comments.load(true)
    await expect(comments.setSort('newest')).rejects.toThrow('refresh failed')

    expect(comments.roots.value.map(({ id }) => id)).toEqual(['root-a'])
    expect(comments.target.value?.resource_id).toBe('video-a')
    expect(comments.page.value).toBe(1)
    expect(comments.hasMore.value).toBe(false)
  })

  it('同一目标 reset 成功后清空旧根评论的回复分页状态', async () => {
    const target = ref({ kind: 'video' as const, resourceId: 'video-a' })
    const listRoots = vi.fn()
      .mockResolvedValueOnce(rootList('video-a', [root('root-a')]))
      .mockResolvedValueOnce(rootList('video-a', [root('root-b')]))
    const listReplies = vi.fn().mockResolvedValue({
      items: [], page: 1, per_page: 20, total: 0, has_more: false,
    })
    const comments = useComments(target, createClient(listRoots, listReplies))

    await comments.load(true)
    await comments.expandReplies('root-a')
    await comments.load(true)

    expect(comments.roots.value.map(({ id }) => id)).toEqual(['root-b'])
    expect(comments.replyState('root-a')).toEqual({
      expanded: false, page: 0, pageSize: 20, hasMore: true, loading: false,
    })
  })
})
