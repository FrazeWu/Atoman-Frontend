import { describe, expect, it } from 'vitest'
import { moduleNavOrder, moduleRooms } from '@/config/moduleRooms'

describe('moduleRooms media integration', () => {
  it('uses functional names for topbar and includes media', () => {
    expect(moduleRooms.feed.name).toBe('订阅')
    expect(moduleRooms.music.name).toBe('音乐')
    expect(moduleRooms.forum.name).toBe('论坛')
    expect(moduleRooms.media.name).toBe('内容')
  })

  it('orders topbar rooms as 订阅 -> 内容 -> 音乐 -> 论坛', () => {
    expect(moduleNavOrder.slice(0, 4)).toEqual(['feed', 'media', 'music', 'forum'])
  })
})
