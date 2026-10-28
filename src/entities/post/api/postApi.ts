import { apiGetEnvelope } from '@/api/client'
import { useApiUrl } from '@/composables/useApiUrl'
import type { Post, PostListFilter } from '../model/types'

// Blog endpoints use /blog/posts, with { data, meta } envelopes.
const postsUrl = () => useApiUrl() + '/blog/posts'

export async function getPostById(idOrSlug: string): Promise<Post> {
  const response = await apiGetEnvelope<Post>(postsUrl() + '/' + encodeURIComponent(idOrSlug))
  return response.data
}

export async function fetchPostList(filters?: PostListFilter): Promise<{ posts: Post[]; total: number }> {
  const query = new URLSearchParams()
  if (filters?.category) query.set('category', filters.category)
  if (filters?.tag) query.set('tag', filters.tag)
  if (filters?.authorId) query.set('user_id', String(filters.authorId))
  if (filters?.page) query.set('page', String(filters.page))
  if (filters?.limit) query.set('page_size', String(filters.limit))
  const qs = query.size ? '?' + query.toString() : ''
  const response = await apiGetEnvelope<Post[], { total?: number }>(postsUrl() + qs)
  return { posts: response.data, total: response.meta?.total ?? response.data.length }
}
