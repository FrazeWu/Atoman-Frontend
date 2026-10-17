import type { Channel, Collection, User } from '@/types'
import type { ResolvedReference } from '@/api/references'

export interface PostCategory {
  id: number | string
  name: string
  slug: string
}

export interface PostTag {
  id: number | string
  name: string
  slug: string
}

export interface PostCitation {
  id: string
  quote: string
  bookTitle?: string
  author?: string
  sourceUrl?: string
}

export interface PostSummary {
  id: string | number
  slug?: string
  title: string
  summary?: string
  coverUrl?: string
  coverImage?: string
  createdAt?: string
  created_at?: string
}

export interface Post {
  id: string
  user_id?: string
  user?: User
  channel_id?: string
  channel?: Channel
  collection_id?: string
  collection?: Collection
  collection_position?: number
  collection_conflict?: boolean
  title: string
  content: string
  summary?: string
  language_code?: string
  cover_url?: string
  coverImage?: string
  status?: 'draft' | 'published' | 'scheduled'
  visibility?: 'public' | 'followers' | 'private'
  allow_comments?: boolean
  pinned?: boolean
  collections?: Collection[]
  published_at?: string
  scheduled_at?: string
  view_count?: number
  rating_score?: number
  rating_count?: number
  viewer_rating?: number
  weighted_rating_score?: number | null
  weighted_rating_count?: number
  weighted_rating_active?: boolean
  tags?: string[]
  public_tags?: Array<{ id: string; name: string; count: number; viewer_added: boolean; created_at: string }>
  liked?: boolean
  bookmarked?: boolean
  bookmarks_count?: number
  bookmarksCount?: number
  channel_followers_count?: number
  likes_count?: number
  likesCount?: number
  comments_count?: number
  references?: ResolvedReference[]
  created_at: string
  createdAt?: string
  updated_at?: string
  updatedAt?: string
  slug?: string
  category?: PostCategory
  citations?: PostCitation[]
  author?: {
    id: number | string
    username: string
    nickname?: string
    avatar?: string
  }
}

export interface PostListFilter {
  category?: string
  tag?: string
  authorId?: number | string
  page?: number
  limit?: number
}
