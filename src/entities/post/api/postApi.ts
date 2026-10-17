import { apiRequestJson } from '@/api/client'
import type { Post, PostListFilter } from '../model/types'

export async function getPostById(idOrSlug: string): Promise<Post> {
  const res = await apiRequestJson<Post>(`/api/v1/posts/${encodeURIComponent(idOrSlug)}`)
  return res
}

export async function fetchPostList(filters?: PostListFilter): Promise<{ posts: Post[]; total: number }> {
  const query = new URLSearchParams()
  if (filters?.category) query.set('category', filters.category)
  if (filters?.tag) query.set('tag', filters.tag)
  if (filters?.page) query.set('page', String(filters.page))
  if (filters?.limit) query.set('limit', String(filters.limit))
  const qs = query.toString() ? `?${query.toString()}` : ''
  return apiRequestJson<{ posts: Post[]; total: number }>(`/api/v1/posts${qs}`)
}
