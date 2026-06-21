import type { Subscription } from '@/types'

export function looksLikeUrl(value?: string | null): boolean {
  const text = value?.trim()
  if (!text) return false
  return /^https?:\/\//i.test(text)
}

export function subscriptionDisplayTitle(sub: Pick<Subscription, 'title' | 'feed_source'>): string {
  const customTitle = sub.title?.trim()
  const sourceTitle = sub.feed_source?.title?.trim()

  if (customTitle && !looksLikeUrl(customTitle)) return customTitle
  if (sourceTitle) return sourceTitle
  if (customTitle) return customTitle
  return '未命名订阅'
}
