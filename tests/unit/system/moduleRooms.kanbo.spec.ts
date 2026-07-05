import { describe, expect, it } from 'vitest'
import { moduleNavOrder, moduleRooms, topbarNavOrder } from '@/config/moduleRooms'

describe('moduleRooms media integration', () => {
  it('uses functional names for topbar and includes media', () => {
    expect(moduleRooms.feed.name).toBe('订阅')
    expect(moduleRooms.music.name).toBe('音乐')
    expect(moduleRooms.forum.name).toBe('论坛')
    expect(moduleRooms.media.name).toBe('播客')
    expect(moduleRooms.blog.name).toBe('博客')
  })

  it('keeps full module order and dedicated topbar order', () => {
    expect(moduleNavOrder.slice(0, 4)).toEqual(['feed', 'media', 'music', 'forum'])
    expect(topbarNavOrder).toEqual(['feed', 'blog', 'music', 'video', 'media', 'debate', 'timeline'])
  })
})
