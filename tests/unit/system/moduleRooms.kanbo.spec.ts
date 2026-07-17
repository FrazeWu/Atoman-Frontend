import { describe, expect, it } from 'vitest'
import { moduleNavOrder, moduleRooms, topbarNavOrder } from '@/config/moduleRooms'

describe('moduleRooms content integration', () => {
  it('uses functional names for active content modules', () => {
    expect(moduleRooms.feed.name).toBe('订阅')
    expect(moduleRooms.music.name).toBe('音乐')
    expect(moduleRooms.forum.name).toBe('论坛')
    expect(moduleRooms.blog.name).toBe('博客')
    expect(moduleRooms.podcast.name).toBe('播客')
  })

  it('keeps full module order and dedicated topbar order without media', () => {
    expect(moduleNavOrder.slice(0, 4)).toEqual(['feed', 'blog', 'music', 'forum'])
    expect(topbarNavOrder).toEqual(['feed', 'blog', 'music', 'video', 'podcast', 'forum', 'debate', 'timeline'])
  })
})
