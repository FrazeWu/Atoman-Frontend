import { ref, unref, type Ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { InteractionComment, InteractionModule, InteractionTargetType } from '@/types'

type CommentOptions = {
  timestamp_sec?: number
}

type ApiEnvelope = {
  data?: unknown
}

type InteractionTargetId = string | Ref<string>

function readItems(data: unknown): InteractionComment[] {
  if (Array.isArray(data)) return data as InteractionComment[]
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: InteractionComment[] }).items
  }
  return []
}

function countComments(items: InteractionComment[]): number {
  return items.reduce((total, item) => total + 1 + (item.replies ? countComments(item.replies) : 0), 0)
}

async function readJson(response: Response): Promise<ApiEnvelope> {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error('请求失败')
  }
  return payload as ApiEnvelope
}

export function useInteractions(moduleName: InteractionModule, targetType: InteractionTargetType, targetId: InteractionTargetId) {
  const api = useApi()
  const authStore = useAuthStore()

  const comments = ref<InteractionComment[]>([])
  const likeCount = ref(0)
  const commentCount = ref(0)
  const liked = ref(false)
  const loadingComments = ref(false)
  const submittingComment = ref(false)
  let fetchCommentsSeq = 0

  const currentTargetId = () => unref(targetId)
  const endpoints = () => ({
    blog: {
      likes: api.interactions.blogLikes,
      comments: api.interactions.blogPostComments(currentTargetId()),
      comment: api.interactions.blogComment,
    },
    forum: {
      topicLike: api.interactions.forumTopicLike(currentTargetId()),
      comments: api.interactions.forumTopicComments(currentTargetId()),
      comment: api.interactions.forumComment,
    },
    videos: {
      likes: undefined,
      comments: api.interactions.videoComments(currentTargetId()),
      comment: api.interactions.videoComment,
    },
  })[moduleName]

  const headers = () => {
    const result: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authStore.token) result.Authorization = `Bearer ${authStore.token}`
    return result
  }

  const applyTargetState = (data: unknown, options: { applyCommentCount?: boolean } = {}) => {
    const applyCommentCount = options.applyCommentCount ?? true
    if (!data || typeof data !== 'object') return
    const target = (data as { target?: unknown }).target
    const source = target && typeof target === 'object' ? target : data
    const values = source as {
      liked?: unknown
      Liked?: unknown
      like_count?: unknown
      LikeCount?: unknown
      comment_count?: unknown
      CommentCount?: unknown
      viewer_liked?: unknown
    }

    if (typeof values.liked === 'boolean') liked.value = values.liked
    if (typeof values.Liked === 'boolean') liked.value = values.Liked
    if (typeof values.viewer_liked === 'boolean') liked.value = values.viewer_liked
    if (typeof values.like_count === 'number') likeCount.value = values.like_count
    if (typeof values.LikeCount === 'number') likeCount.value = values.LikeCount
    if (applyCommentCount && typeof values.comment_count === 'number') commentCount.value = values.comment_count
    if (applyCommentCount && typeof values.CommentCount === 'number') commentCount.value = values.CommentCount
  }

  const like = async () => {
    const selectedEndpoints = endpoints()
    if (moduleName === 'forum') {
      const response = await fetch(selectedEndpoints.topicLike, {
        method: 'POST',
        headers: headers(),
        credentials: 'include',
      })
      const payload = await readJson(response)
      const nextLiked = payload.data && typeof payload.data === 'object'
        ? (payload.data as { liked?: unknown }).liked
        : undefined
      if (typeof nextLiked === 'boolean') {
        liked.value = nextLiked
        likeCount.value = Math.max(0, likeCount.value + (nextLiked ? 1 : -1))
      }
      return
    }
    if (!selectedEndpoints.likes) return
    const response = await fetch(selectedEndpoints.likes, {
      method: 'POST',
      headers: headers(),
      credentials: 'include',
      body: JSON.stringify({ target_type: targetType, target_id: currentTargetId() }),
    })
    const payload = await readJson(response)
    applyTargetState(payload.data)
  }

  const unlike = async () => {
    const selectedEndpoints = endpoints()
    if (moduleName === 'forum') {
      const response = await fetch(selectedEndpoints.topicLike, {
        method: 'POST',
        headers: headers(),
        credentials: 'include',
      })
      const payload = await readJson(response)
      const nextLiked = payload.data && typeof payload.data === 'object'
        ? (payload.data as { liked?: unknown }).liked
        : undefined
      if (typeof nextLiked === 'boolean') {
        liked.value = nextLiked
        likeCount.value = Math.max(0, likeCount.value + (nextLiked ? 1 : -1))
      }
      return
    }
    if (!selectedEndpoints.likes) return
    const response = await fetch(selectedEndpoints.likes, {
      method: 'DELETE',
      headers: headers(),
      credentials: 'include',
      body: JSON.stringify({ target_type: targetType, target_id: currentTargetId() }),
    })
    const payload = await readJson(response)
    applyTargetState(payload.data)
  }

  const fetchComments = async () => {
    const requestSeq = ++fetchCommentsSeq
    const requestTargetId = currentTargetId()
    loadingComments.value = true
    try {
      const response = await fetch(endpoints().comments, {
        headers: headers(),
        credentials: 'include',
      })
      const payload = await readJson(response)
      if (requestSeq !== fetchCommentsSeq || requestTargetId !== currentTargetId()) return

      comments.value = readItems(payload.data)
      commentCount.value = countComments(comments.value)
      applyTargetState(payload.data, { applyCommentCount: false })
    } finally {
      if (requestSeq === fetchCommentsSeq) {
        loadingComments.value = false
      }
    }
  }

  const createComment = async (content: string, parentCommentId?: string, options?: CommentOptions) => {
    submittingComment.value = true
    try {
      const body = {
        content,
        ...(parentCommentId ? { [moduleName === 'forum' ? 'reply_to_id' : 'parent_comment_id']: parentCommentId } : {}),
        ...(options?.timestamp_sec !== undefined ? { timestamp_sec: options.timestamp_sec } : {}),
      }
      const response = await fetch(endpoints().comments, {
        method: 'POST',
        headers: headers(),
        credentials: 'include',
        body: JSON.stringify(body),
      })
      await readJson(response)
      await fetchComments()
    } finally {
      submittingComment.value = false
    }
  }

  const deleteComment = async (commentId: string) => {
    const response = await fetch(endpoints().comment(commentId), {
      method: 'DELETE',
      headers: headers(),
      credentials: 'include',
    })
    await readJson(response)
    await fetchComments()
  }

  return {
    comments,
    likeCount,
    commentCount,
    liked,
    loadingComments,
    submittingComment,
    like,
    unlike,
    fetchComments,
    createComment,
    deleteComment,
  }
}
