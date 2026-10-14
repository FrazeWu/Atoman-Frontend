import { describe, expect, it } from 'vitest'
import {
  formatNotificationBody,
  formatNotificationTime,
  formatNotificationTitle,
  notificationActionType,
  notificationSourceLabel,
  notificationTargetPath,
} from '@/utils/notificationHelpers'
import type { Notification } from '@/types'

const baseNotification: Notification = {
  id: 'notif-base',
  recipient_id: 'user-1',
  actor_id: 'actor-1',
  actor: {
    uuid: 'actor-1',
    username: 'bob',
    display_name: '鲍勃',
    roles: [],
  },
  latest_actor: null,
  type: 'comment_reply',
  category: 'reply',
  reason: '测试通知',
  source_type: 'comment',
  source_id: '123',
  actor_count: 1,
  meta: {},
  created_at: new Date().toISOString(),
}

describe('notificationHelpers', () => {
  describe('notificationActionType', () => {
    it('identifies like types', () => {
      expect(notificationActionType({ ...baseNotification, type: 'comment_like', category: 'like' })).toBe('like')
      expect(notificationActionType({ ...baseNotification, type: 'forum_like', category: 'interaction' })).toBe('like')
    })

    it('identifies reply types', () => {
      expect(notificationActionType({ ...baseNotification, type: 'comment_reply', category: 'reply' })).toBe('reply')
      expect(notificationActionType({ ...baseNotification, type: 'forum_reply', category: 'interaction' })).toBe('reply')
    })

    it('identifies mention types', () => {
      expect(notificationActionType({ ...baseNotification, type: 'comment_mention', category: 'mention' })).toBe('mention')
      expect(notificationActionType({ ...baseNotification, type: 'content_mention', category: 'mention' })).toBe('mention')
    })

    it('identifies forum types', () => {
      expect(notificationActionType({ ...baseNotification, type: 'forum_topic_comment', category: 'interaction' })).toBe('forum')
      expect(notificationActionType({ ...baseNotification, type: 'forum_follow', category: 'interaction' })).toBe('forum')
    })

    it('identifies collaboration types', () => {
      expect(notificationActionType({ ...baseNotification, type: 'content_published', category: 'collaboration' })).toBe('collaboration')
      expect(notificationActionType({ ...baseNotification, type: 'lyrics_update', source_type: 'music_lyrics', category: 'collaboration' })).toBe('collaboration')
    })

    it('identifies system types', () => {
      expect(notificationActionType({ ...baseNotification, type: 'site_announcement', category: 'system' })).toBe('system')
    })
  })

  describe('formatNotificationTitle', () => {
    it('formats comment like with multiple actors', () => {
      const notif: Notification = {
        ...baseNotification,
        type: 'comment_like',
        category: 'like',
        meta: { like_count: 5 },
      }
      expect(formatNotificationTitle(notif)).toBe('鲍勃 等 5 人赞了你')
    })

    it('formats explicit meta title if provided', () => {
      const notif: Notification = {
        ...baseNotification,
        meta: { title: '自定义标题' },
      }
      expect(formatNotificationTitle(notif)).toBe('自定义标题')
    })
  })

  describe('formatNotificationBody', () => {
    it('returns body or reason as fallback', () => {
      expect(formatNotificationBody({ ...baseNotification, type: 'custom', reason: '特别原因' })).toBe('特别原因')
      expect(formatNotificationBody({ ...baseNotification, type: 'comment_reply' })).toBe('查看回复')
    })
  })

  describe('formatNotificationTime', () => {
    it('handles recent times', () => {
      expect(formatNotificationTime(new Date().toISOString())).toBe('刚刚')
      expect(formatNotificationTime(null)).toBe('刚刚')
      expect(formatNotificationTime('invalid')).toBe('刚刚')
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      expect(formatNotificationTime(tenMinsAgo)).toBe('10 分钟前')
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString()
      expect(formatNotificationTime(twoHoursAgo)).toBe('2 小时前')
    })
  })

  describe('notificationTargetPath', () => {
    it('returns source_url if provided', () => {
      expect(notificationTargetPath({ ...baseNotification, source_url: '/direct/url' })).toBe('/direct/url')
    })

    it('resolves site announcement path', () => {
      expect(notificationTargetPath({ ...baseNotification, type: 'site_announcement', meta: { path: '/updates/new' } })).toBe('/updates/new')
    })

    it('resolves forum reply location', () => {
      expect(notificationTargetPath({
        ...baseNotification,
        type: 'forum_reply',
        source_type: 'forum_reply',
        source_id: '99',
        meta: { topic_id: 't-1' },
      })).toBe('/forum/topic/t-1#reply-99')
    })
  })
})
