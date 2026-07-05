import { describe, expect, it } from 'vitest'
import { footbarLinks, moduleNavOrder, moduleRooms, notificationRoom, topbarNavOrder } from '@/config/moduleRooms'

describe('module room naming config', () => {
  it('contains the approved room names and helper labels', () => {
    expect(moduleRooms.feed).toMatchObject({ name: '订阅', helper: 'RSS 与更新流' })
    expect(moduleRooms.music).toMatchObject({ name: '音乐', helper: '音乐档案' })
    expect(moduleRooms.blog).toMatchObject({ name: '博客', helper: '内容视图' })
    expect(moduleRooms.forum).toMatchObject({ name: '论坛', helper: '讨论与发帖' })
    expect(moduleRooms.debate).toMatchObject({ name: '辩论', helper: '辩题讨论' })
    expect(moduleRooms.timeline).toMatchObject({ name: '时间线', helper: '人物时间线' })
    expect(moduleRooms.podcast).toMatchObject({ name: '播客', helper: '内容视图' })
    expect(moduleRooms.video).toMatchObject({ name: '视频', helper: '内容视图' })
  })

  it('keeps module navigation order stable', () => {
    expect(moduleNavOrder).toEqual(['feed', 'blog', 'music', 'forum', 'debate', 'timeline', 'podcast', 'video'])
  })

  it('keeps topbar navigation order stable', () => {
    expect(topbarNavOrder).toEqual(['feed', 'blog', 'music', 'video', 'podcast', 'debate', 'timeline'])
  })

  it('uses root home paths for subdomain-scoped modules', () => {
    for (const [key, room] of Object.entries(moduleRooms)) {
      expect(room.homePath, key).toBe('/')
    }
  })

  it('keeps topbar module names compact', () => {
    for (const key of moduleNavOrder) {
      const room = moduleRooms[key]
      expect(room.name.length, key).toBeLessThanOrEqual(3)
    }
  })

  it('names notifications as 通知', () => {
    expect(notificationRoom).toMatchObject({
      name: '通知',
      helper: '通知与提醒',
      homepageSub: '通知与私信统一收纳在这里。',
    })
  })

  it('contains the required footbar links', () => {
    expect(footbarLinks.map((link) => link.label)).toEqual([
      '关于',
      '联系我们',
      '提交 Issue',
      '使用条款',
      '隐私政策',
    ])
  })
})
