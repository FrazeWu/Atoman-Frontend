import type { FeedArticleSource, FeedExploreSource, FeedSourceCategory } from '@/types'
import {
  ALL_RECOMMENDATION_LANGUAGE,
  detectDefaultRecommendationLanguage,
  normalizeRecommendationLanguage,
  type RecommendationLanguage,
} from '@/utils/recommendationLanguage'
import { buildSourceFaviconURL } from '@/utils/feedSourcePresentation'

export const ALL_CATEGORY = 'all'
export const ALL_THEME = 'all'

export type FeedSourceFilterCategory = typeof ALL_CATEGORY | FeedSourceCategory
export type RecommendationMode = 'featured' | 'random'

export interface RecommendationItem {
  id: string
  title: string
  summary?: string
  description?: string
  content_type?: string
  language_code?: string
  source_subscribed?: boolean
  avatar_url?: string
  image_url?: string
  source_image_url?: string
  target_path: string
  source_id?: string
  source_title?: string
  source_type?: string
  source_category?: string
  platform?: 'youtube' | 'bilibili' | 'github'
  source_content_type?: 'video' | 'project_update'
  source_path?: string
  rss_url?: string
  score_label?: string
  bookmark_count?: number
  read_count?: number
  view_count?: number
  rating_score?: number
  rating_count?: number
  update_frequency_label?: string
  last_published_at?: string
  subscribed?: boolean
  recent_items?: Array<{ id: string; title: string }>
}

export function normalizeMode(raw: unknown): RecommendationMode {
  return raw === 'random' ? 'random' : 'featured'
}

export function normalizeCategory(raw: unknown): FeedSourceFilterCategory {
  return raw === 'blog' || raw === 'news' || raw === 'social' || raw === 'video' || raw === 'forum' || raw === 'podcast'
    ? raw
    : ALL_CATEGORY
}

export function normalizeLanguage(raw: unknown): RecommendationLanguage {
  if (raw === ALL_RECOMMENDATION_LANGUAGE) return ALL_RECOMMENDATION_LANGUAGE
  return normalizeRecommendationLanguage(raw) ?? detectDefaultRecommendationLanguage()
}

export function normalizePage(value: unknown) {
  const pageValue = Number.parseInt(String(value || '1'), 10)
  return Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1
}

export function normalizedCategoryParam(value: FeedSourceFilterCategory) {
  return value === ALL_CATEGORY ? 'all' : value
}

export function formatDate(dateStr?: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function articleAvatarURL(item: RecommendationItem) {
  const candidates = [
    item.source_image_url,
    buildSourceFaviconURL(item.rss_url),
    item.avatar_url,
    item.image_url,
  ]
  return candidates.find((value) => value?.trim())?.trim() || ''
}

export function toRecommendedSource(item: RecommendationItem): FeedExploreSource {
  return {
    id: item.source_id || item.id,
    title: item.title,
    rssUrl: item.rss_url,
    coverUrl: item.image_url,
    category: (item.source_category as FeedSourceCategory) || 'blog',
    subscriptionCount: item.bookmark_count ?? item.read_count ?? 0,
    recentItemCount: item.recent_items?.length ?? 0,
    lastPublishedAt: item.last_published_at,
    subscribed: Boolean(item.subscribed),
    recentItems: item.recent_items ?? [],
    description: item.summary || item.description,
    platform: item.platform,
    content_type: item.source_content_type,
  }
}

export function channelMetricLabel(item: RecommendationItem) {
  return item.source_category ? item.source_category.toUpperCase() : 'RECOMMENDED'
}

export function channelSummaryText(item: RecommendationItem) {
  return item.summary || item.description || ''
}

export function channelMetadataText(item: RecommendationItem) {
  const parts: string[] = []
  if (item.bookmark_count !== undefined) parts.push(`${item.bookmark_count} 订阅`)
  if (item.update_frequency_label) parts.push(item.update_frequency_label)
  return parts.join(' · ')
}

export function subscriptionSourceId(item: RecommendationItem) {
  return item.source_id || item.id
}

export function sourceSubscriptionContext(source: RecommendationItem | FeedArticleSource) {
  if ('type' in source) {
    return {
      id: source.id,
      title: source.title,
      type: source.type,
      rssUrl: source.rssUrl,
    }
  }
  return {
    id: subscriptionSourceId(source),
    title: source.title,
    type: source.source_type === 'external_rss' ? ('external_rss' as const) : ('internal_channel' as const),
    rssUrl: source.rss_url,
  }
}

export function sourceFromRecommendation(item: RecommendationItem): FeedArticleSource {
  const isInternalChannel = item.source_type === 'internal_channel' || item.target_path?.startsWith('/channels/')
  return {
    id: subscriptionSourceId(item),
    title: item.source_title || item.title,
    rssUrl: item.rss_url,
    imageUrl: item.source_image_url || (item.source_title ? undefined : item.image_url),
    type: isInternalChannel ? 'internal_channel' : 'external_rss',
    subscribed: Boolean(item.source_subscribed || item.subscribed),
    platform: item.platform,
    contentType: item.source_content_type,
  }
}
