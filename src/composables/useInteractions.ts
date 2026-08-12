import { isRef, ref, unref, watch, type Ref } from 'vue'
import { apiRequestEnvelope } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { InteractionComment, InteractionModule, InteractionTargetType } from '@/types'

type CommentOptions = {
  timestamp_sec?: number
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
  let interactionSeq = 0

  if (isRef(targetId)) {
    watch(targetId, () => {
      interactionSeq += 1
    }, { flush: 'sync' })
  }

  const currentTargetId = () => unref(targetId)
  const isShortNote = () => moduleName === 'blog' && targetType === 'short_note'
  const endpoints = () => ({
    blog: {
      likes: api.interactions.blogLikes,
      comments: isShortNote()
        ? api.interactions.shortNoteComments(currentTargetId())
        : api.interactions.blogPostComments(currentTargetId()),
      comment: isShortNote() ? api.comments.comment : api.interactions.blogComment,
    },
    forum: {
      topicLike: api.interactions.forumTopicLike(currentTargetId()),
      comments: api.interactions.forumTopicComments(currentTargetId()),
      comment: api.interactions.forumComment,
    },
    videos: {
      likes: api.videos.likes,
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
    const requestTargetId = currentTargetId()
    const requestSeq = ++interactionSeq
    const selectedEndpoints = endpoints()
    if (isShortNote()) {
      await apiRequestEnvelope<unknown>(api.blog.shortNoteLike(requestTargetId), {
        method: 'POST',
        headers: headers(),
      })
      if (requestSeq !== interactionSeq || requestTargetId !== currentTargetId()) return
      liked.value = true
      likeCount.value += 1
      return
    }
    if (moduleName === 'forum') {
      const topicLike = selectedEndpoints.topicLike
      if (!topicLike) return
      const payload = await apiRequestEnvelope<unknown>(topicLike, {
        method: 'POST',
        headers: headers(),
      })
      if (requestSeq !== interactionSeq || requestTargetId !== currentTargetId()) return
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
    const payload = await apiRequestEnvelope<unknown>(selectedEndpoints.likes, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ target_type: targetType, target_id: requestTargetId }),
    })
    if (requestSeq !== interactionSeq || requestTargetId !== currentTargetId()) return
    applyTargetState(payload.data)
  }

  const unlike = async () => {
    const requestTargetId = currentTargetId()
    const requestSeq = ++interactionSeq
    const selectedEndpoints = endpoints()
    if (isShortNote()) {
      await apiRequestEnvelope<unknown>(api.blog.shortNoteLike(requestTargetId), {
        method: 'DELETE',
        headers: headers(),
      })
      if (requestSeq !== interactionSeq || requestTargetId !== currentTargetId()) return
      liked.value = false
      likeCount.value = Math.max(0, likeCount.value - 1)
      return
    }
    if (moduleName === 'forum') {
      const topicLike = selectedEndpoints.topicLike
      if (!topicLike) return
      const payload = await apiRequestEnvelope<unknown>(topicLike, {
        method: 'POST',
        headers: headers(),
      })
      if (requestSeq !== interactionSeq || requestTargetId !== currentTargetId()) return
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
    const payload = await apiRequestEnvelope<unknown>(selectedEndpoints.likes, {
      method: 'DELETE',
      headers: headers(),
      body: JSON.stringify({ target_type: targetType, target_id: requestTargetId }),
    })
    if (requestSeq !== interactionSeq || requestTargetId !== currentTargetId()) return
    applyTargetState(payload.data)
  }

  const fetchComments = async () => {
    const requestSeq = ++fetchCommentsSeq
    const requestTargetId = currentTargetId()
    loadingComments.value = true
    try {
      const payload = await apiRequestEnvelope<unknown>(endpoints().comments, {
        headers: headers(),
      })
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
      await apiRequestEnvelope<unknown>(endpoints().comments, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      })
      await fetchComments()
    } finally {
      submittingComment.value = false
    }
  }

  const deleteComment = async (commentId: string) => {
    await apiRequestEnvelope<unknown>(endpoints().comment(commentId), {
      method: 'DELETE',
      headers: headers(),
    })
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
