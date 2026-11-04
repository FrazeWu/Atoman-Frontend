import type { ShortNote } from '@/types'

export interface BlogChannel {
  id: string | number
  name: string
  slug?: string
  description?: string
  cover_url?: string
  updated_at?: string
  user?: {
    uuid?: string
    username?: string
    display_name?: string
    avatar_url?: string
  }
}

export interface BlogCollection {
  id: string | number
  name: string
}

export interface BlogHomeListItem {
  id: string
  title: string
  summary?: string
  cover_url?: string
  created_at?: string
  view_count?: number
  read_count?: number
  rating_score?: number
  rating_count?: number
  bookmarks_count?: number
  likes_count?: number
  comments_count?: number
  channel?: BlogChannel
  user?: {
    username?: string
    display_name?: string
    avatar_url?: string
  }
  source: 'post' | 'feed'
  sourceTitle?: string
  targetPath: string
  recommendationReason?: string
  publicTagCount?: number
}

export interface RecommendationPayload {
  id: string
  title: string
  summary?: string
  description?: string
  excerpt?: string
  image_url?: string
  cover_url?: string
  target_path?: string
  source_title?: string
  score_label?: string
  snippet?: string
  match_field?: string
  view_count?: number
  read_count?: number
  rating_score?: number
  rating_count?: number
  bookmark_count?: number
  bookmarks_count?: number
  likes_count?: number
  comments_count?: number
  public_tag_count?: number
  created_at?: string
  published_at?: string
  user?: BlogHomeListItem['user']
  channel?: BlogChannel
  post?: BlogHomeListItem
}

export interface BlogDigestPayload {
  period: 'day' | 'week'
  total: number
  items: Array<{
    id: string
    title: string
    target_path: string
    channel?: BlogChannel
  }>
}

export const unwrapBlogDigest = (value: unknown): BlogDigestPayload | null => {
  const candidate = value && typeof value === 'object' && 'data' in value
    ? value.data
    : value
  if (!candidate || typeof candidate !== 'object') return null
  const digest = candidate as Partial<BlogDigestPayload>
  if ((digest.period !== 'day' && digest.period !== 'week') || typeof digest.total !== 'number' || !Array.isArray(digest.items)) {
    return null
  }
  return digest as BlogDigestPayload
}

export type BlogHomeStreamItem =
  | { kind: 'post'; key: string; timestamp?: string; post: BlogHomeListItem }
  | { kind: 'note'; key: string; timestamp?: string; note: ShortNote }
