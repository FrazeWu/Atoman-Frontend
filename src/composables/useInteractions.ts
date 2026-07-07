import { ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { InteractionComment, InteractionModule, InteractionTargetType } from '@/types'

type CommentOptions = {
  timestamp_sec?: number
}

type ApiEnvelope = {
  data?: unknown
}

function readItems(data: unknown): InteractionComment[] {
  if (Array.isArray(data)) return data as InteractionComment[]
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: InteractionComment[] }).items
  }
  return []
}

async function readJson(response: Response): Promise<ApiEnvelope> {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error('请求失败')
  }
  return payload as ApiEnvelope
}

export function useInteractions(moduleName: InteractionModule, targetType: InteractionTargetType, targetId: string) {
  const api = useApi()
  const authStore = useAuthStore()

  const comments = ref<InteractionComment[]>([])
  const likeCount = ref(0)
  const commentCount = ref(0)
  const liked = ref(false)
  const loadingComments = ref(false)
  const submittingComment = ref(false)

  const endpoints = {
    blog: {
      likes: api.interactions.blogLikes,
      comments: api.interactions.blogPostComments(targetId),
      comment: api.interactions.blogComment,
    },
    forum: {
      likes: api.interactions.forumLikes,
      comments: api.interactions.forumTopicComments(targetId),
      comment: api.interactions.forumComment,
    },
    videos: {
      likes: api.interactions.videoLikes,
      comments: api.interactions.videoComments(targetId),
      comment: api.interactions.videoComment,
    },
  }[moduleName]

  const headers = () => {
    const result: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authStore.token) result.Authorization = `Bearer ${authStore.token}`
    return result
  }

  const applyTargetState = (data: unknown) => {
    if (!data || typeof data !== 'object') return
    const target = (data as { target?: unknown }).target
    const source = target && typeof target === 'object' ? target : data
    const values = source as { liked?: unknown; like_count?: unknown; comment_count?: unknown; viewer_liked?: unknown }

    if (typeof values.liked === 'boolean') liked.value = values.liked
    if (typeof values.viewer_liked === 'boolean') liked.value = values.viewer_liked
    if (typeof values.like_count === 'number') likeCount.value = values.like_count
    if (typeof values.comment_count === 'number') commentCount.value = values.comment_count
  }

  const like = async () => {
    const response = await fetch(endpoints.likes, {
      method: 'POST',
      headers: headers(),
      credentials: 'include',
      body: JSON.stringify({ target_type: targetType, target_id: targetId }),
    })
    const payload = await readJson(response)
    applyTargetState(payload.data)
  }

  const unlike = async () => {
    const response = await fetch(endpoints.likes, {
      method: 'DELETE',
      headers: headers(),
      credentials: 'include',
      body: JSON.stringify({ target_type: targetType, target_id: targetId }),
    })
    const payload = await readJson(response)
    applyTargetState(payload.data)
  }

  const fetchComments = async () => {
    loadingComments.value = true
    try {
      const response = await fetch(endpoints.comments, {
        headers: headers(),
        credentials: 'include',
      })
      const payload = await readJson(response)
      comments.value = readItems(payload.data)
      commentCount.value = comments.value.length
      applyTargetState(payload.data)
    } finally {
      loadingComments.value = false
    }
  }

  const createComment = async (content: string, parentCommentId?: string, options?: CommentOptions) => {
    submittingComment.value = true
    try {
      const body = {
        content,
        ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
        ...(options?.timestamp_sec !== undefined ? { timestamp_sec: options.timestamp_sec } : {}),
      }
      const response = await fetch(endpoints.comments, {
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
    const response = await fetch(endpoints.comment(commentId), {
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
