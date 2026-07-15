import { computed, reactive, ref, toValue, type MaybeRefOrGetter } from 'vue'

import {
  commentApi,
  type CommentApiClient,
  type CommentDTO,
  type CommentReplyList,
  type CommentTargetRef,
  type CreateCommentInput,
  type EditCommentInput,
  type ReportCommentInput,
} from '@/api/comments'

interface ReplyPaginationState { expanded: boolean; page: number; pageSize: number; hasMore: boolean; loading: boolean }

const targetKey = (target: CommentTargetRef) => `${target.kind}:${target.resourceId}`
const mergeById = (current: CommentDTO[], incoming: CommentDTO[]) => {
  const seen = new Set(current.map(({ id }) => id))
  const merged = [...current]
  incoming.forEach((comment) => {
    if (seen.has(comment.id)) return
    seen.add(comment.id)
    merged.push(comment)
  })
  return merged
}
const sortReplies = (items: CommentDTO[]) => [...items].sort((a, b) =>
  a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
)

export function useComments(targetSource: MaybeRefOrGetter<CommentTargetRef>, client: CommentApiClient = commentApi) {
  const roots = ref<CommentDTO[]>([])
  const target = ref<Awaited<ReturnType<CommentApiClient['listRoots']>>['target'] | null>(null)
  const sort = ref<'oldest' | 'newest' | 'hot'>('oldest')
  const page = ref(0)
  const pageSize = ref(20)
  const loading = ref(false)
  const error = ref<unknown>(null)
  const hasMore = ref(true)
  const replyStates = reactive<Record<string, ReplyPaginationState>>({})
  const pendingLikes = reactive(new Set<string>())
  let generation = 0

  const findComment = (id: string) => {
    for (const root of roots.value) {
      if (root.id === id) return root
      const child = root.replies.find((reply) => reply.id === id)
      if (child) return child
    }
  }

  const replaceComment = (next: CommentDTO) => {
    const rootIndex = roots.value.findIndex(({ id }) => id === next.id)
    if (rootIndex >= 0) {
      roots.value[rootIndex] = next
      return
    }
    for (const root of roots.value) {
      const childIndex = root.replies.findIndex(({ id }) => id === next.id)
      if (childIndex >= 0) {
        root.replies[childIndex] = next
        return
      }
    }
  }

  const load = async (reset = true) => {
    const requestedTarget = toValue(targetSource)
    const requestedKey = targetKey(requestedTarget)
    const requestedPage = reset ? 1 : Math.max(1, page.value)
    const requestGeneration = reset ? ++generation : generation
    loading.value = true
    error.value = null
    try {
      const result = await client.listRoots(requestedTarget, {
        sort: sort.value, page: requestedPage, page_size: pageSize.value,
      })
      if (requestGeneration !== generation || requestedKey !== targetKey(toValue(targetSource))) return
      roots.value = reset ? mergeById([], result.items) : mergeById(roots.value, result.items)
      target.value = result.target
      page.value = result.page
      hasMore.value = result.page * result.per_page < result.total_roots
      if (reset) Object.keys(replyStates).forEach((key) => delete replyStates[key])
    } catch (caught) {
      if (requestGeneration === generation && requestedKey === targetKey(toValue(targetSource))) error.value = caught
      throw caught
    } finally {
      if (requestGeneration === generation) loading.value = false
    }
  }

  const loadMore = async () => {
    if (loading.value || !hasMore.value) return
    page.value += 1
    try {
      await load(false)
    } catch (caught) {
      page.value -= 1
      throw caught
    }
  }

  const setSort = async (next: typeof sort.value) => {
    if (sort.value === next && page.value > 0) return
    sort.value = next
    await load(true)
  }

  const replyState = (rootId: string) => replyStates[rootId] ?? {
    expanded: false, page: 0, pageSize: 20, hasMore: true, loading: false,
  }

  const expandReplies = async (rootId: string, requestedPage = 1, requestedPageSize = 20) => {
    const root = roots.value.find(({ id }) => id === rootId)
    if (!root) return
    const state = replyStates[rootId] ??= {
      expanded: false, page: 0, pageSize: requestedPageSize, hasMore: true, loading: false,
    }
    if (state.loading) return
    state.loading = true
    try {
      const result: CommentReplyList = await client.listReplies(rootId, { page: requestedPage, page_size: requestedPageSize })
      root.replies = sortReplies(mergeById(root.replies, result.items))
      state.expanded = true
      state.page = result.page
      state.pageSize = result.per_page
      state.hasMore = result.has_more
    } finally {
      state.loading = false
    }
  }

  const create = async (input: CreateCommentInput) => {
    const created = await client.create(toValue(targetSource), input)
    if (created.root_id) {
      const root = roots.value.find(({ id }) => id === created.root_id)
      if (root && !root.replies.some(({ id }) => id === created.id)) {
        root.replies = sortReplies([...root.replies, created])
        root.reply_count += 1
      }
      if (target.value) target.value.comment_count += 1
      return created
    }
    await load(true)
    return created
  }

  const edit = async (commentId: string, input: EditCommentInput) => {
    const edited = await client.edit(commentId, input)
    replaceComment(edited)
    return edited
  }

  const remove = async (commentId: string) => {
    const existing = findComment(commentId)
    await client.delete(commentId)
    if (!existing?.root_id) {
      roots.value = roots.value.filter(({ id }) => id !== commentId)
    } else {
      const root = roots.value.find(({ id }) => id === existing.root_id)
      if (root) {
        root.replies = root.replies.filter(({ id }) => id !== commentId)
        root.reply_count = Math.max(0, root.reply_count - 1)
      }
      if (target.value) target.value.comment_count = Math.max(0, target.value.comment_count - 1)
      return
    }
    await load(true)
  }

  const toggleLike = async (commentId: string) => {
    if (pendingLikes.has(commentId)) return
    const existing = findComment(commentId)
    if (!existing) return
    const original = { liked: existing.liked, like_count: existing.like_count }
    pendingLikes.add(commentId)
    existing.liked = !original.liked
    existing.like_count = Math.max(0, original.like_count + (existing.liked ? 1 : -1))
    try {
      if (existing.liked) await client.like(commentId)
      else await client.unlike(commentId)
    } catch (caught) {
      existing.liked = original.liked
      existing.like_count = original.like_count
      error.value = caught
      throw caught
    } finally {
      pendingLikes.delete(commentId)
    }
  }

  const report = (commentId: string, input: ReportCommentInput) => client.report(commentId, input)

  const mark = async (commentId: string) => {
    await client.mark(toValue(targetSource), commentId)
    await load(true)
  }

  const unmark = async () => {
    await client.unmark(toValue(targetSource))
    await load(true)
  }

  return {
    roots, target, sort, page, pageSize, loading, error, hasMore,
    isLikePending: (id: string) => computed(() => pendingLikes.has(id)),
    replyState, load, loadMore, setSort, expandReplies, create, edit, remove, toggleLike, report, mark, unmark,
  }
}
