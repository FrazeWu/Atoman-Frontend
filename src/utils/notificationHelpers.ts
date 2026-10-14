import type { RouteLocationRaw } from 'vue-router'
import type { Notification } from '@/types'
import {
  commentNotificationLocation,
  contentPublishedLocation,
  forumNotificationLocation,
  isCommentNotification,
} from '@/stores/notification'
import { referenceHref } from '@/composables/useReferenceRendering'

export function notificationActionType(
  notification: Notification
): 'like' | 'reply' | 'mention' | 'forum' | 'collaboration' | 'system' {
  const type = notification.type || ''
  const category = notification.category || ''
  const sourceType = notification.source_type || ''

  if (category === 'like' || type.includes('like')) {
    return 'like'
  }
  if (category === 'reply' || type.includes('reply')) {
    return 'reply'
  }
  if (category === 'mention' || type.includes('mention')) {
    return 'mention'
  }
  if (type.startsWith('forum_') || sourceType.startsWith('forum_')) {
    return 'forum'
  }
  if (
    category === 'collaboration' ||
    type === 'content_published' ||
    sourceType === 'music_lyrics' ||
    sourceType === 'music_album_import'
  ) {
    return 'collaboration'
  }
  if (
    category === 'system' ||
    type === 'site_announcement' ||
    type === 'feed_source_health'
  ) {
    return 'system'
  }
  return 'system'
}

export function notificationSourceLabel(notification: Notification): string {
  return notification.meta?.source_label || notification.meta?.topic_title || ''
}

export function formatNotificationTitle(notification: Notification): string {
  const actor = notification.actor?.display_name || notification.actor?.username || '有人'
  if (notification.type === 'forum_topic_comment') return '新评论'
  if (notification.type === 'forum_follow') return '新帖子'
  if (notification.meta?.title) return notification.meta.title
  switch (notification.type) {
    case 'forum_reply':
      return `${actor} 回复了你`
    case 'forum_like':
      return `${actor} 赞了你`
    case 'forum_mention':
      return `${actor} 提到了你`
    case 'forum_solved':
      return `${actor} 采纳了你的回复`
    case 'comment_reply':
      return `${actor} 回复了你`
    case 'comment_mention':
      return `${actor} 提到了你`
    case 'content_mention':
      return `${actor} 提到了你`
    case 'comment_marked':
      return `${actor} 标记了你的评论`
    case 'comment_like':
      return notification.meta?.like_count && notification.meta.like_count > 1
        ? `${actor} 等 ${notification.meta.like_count} 人赞了你`
        : `${actor} 赞了你`
    default:
      if (notification.category === 'like') return `${actor} 赞了你`
      if (notification.category === 'reply') return `${actor} 回复了你`
      if (notification.category === 'mention') return `${actor} 提到了你`
      return '新通知'
  }
}

export function formatNotificationBody(notification: Notification): string {
  if (notification.type === 'forum_topic_comment' || notification.type === 'forum_follow') {
    return notification.meta?.topic_title || notification.meta?.title || '查看帖子'
  }
  if (notification.type === 'comment_reply') return '查看回复'
  if (notification.type === 'comment_mention') return '查看提及'
  if (notification.type === 'content_mention') return '查看提及'
  if (notification.type === 'comment_marked') return '查看标记'
  if (notification.type === 'comment_like') return '查看点赞'
  return notification.reason || notification.meta?.body || notification.meta?.reply_excerpt || notification.meta?.topic_title || '查看详情'
}

export function formatNotificationTime(dateStr?: string | null): string {
  if (!dateStr) return '刚刚'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '刚刚'
  const diff = Math.max(0, Date.now() - d.getTime())
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return d.toLocaleDateString('zh-CN')
}

export function notificationTargetPath(notification: Notification): RouteLocationRaw | string | null {
  if (notification.source_url) {
    if (
      typeof notification.source_url === 'string' &&
      notification.source_url.startsWith('/') &&
      !notification.source_url.startsWith('//')
    ) {
      return notification.source_url
    }
    return null
  }
  if (notification.type === 'site_announcement' || notification.type === 'feed_source_health') {
    const path = notification.meta?.path
    if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')) return path
  }
  if (notification.type === 'content_mention' && notification.meta?.module && notification.meta?.path) {
    return referenceHref({ module: notification.meta.module, path: notification.meta.path })
  }
  if (isCommentNotification(notification)) {
    const loc = commentNotificationLocation(notification)
    if (loc) return loc
  }
  if (notification.type === 'content_published') {
    const loc = contentPublishedLocation(notification)
    if (loc) return loc
  }
  if (notification.type === 'forum_follow') {
    const loc = forumNotificationLocation(notification)
    if (loc) return loc
  }
  if (notification.source_type === 'music_lyrics') {
    const { album_id: albumId, song_id: songId, annotation_id: annotationId } = (notification.meta || {}) as Record<string, unknown>
    if (typeof albumId === 'string' && typeof songId === 'string' && typeof annotationId === 'string') {
      return {
        path: `/music/song/${songId}`,
        query: { annotation_id: annotationId, rebind: '1' },
      }
    }
  }
  if (notification.source_type === 'music_album_import') {
    return '/music/imports'
  }
  const topicId = notification.meta?.topic_id
  if (notification.source_type === 'forum_reply' && topicId) {
    return `/forum/topic/${topicId}#reply-${notification.source_id}`
  }
  if (notification.source_type === 'forum_topic' && notification.source_id) {
    return `/forum/topic/${notification.source_id}`
  }
  return null
}
