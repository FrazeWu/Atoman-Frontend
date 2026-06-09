import { describe, expect, it } from 'vitest'
import { moduleNavOrder, moduleRooms } from '@/config/moduleRooms'

describe('moduleRooms kanbo integration', () => {
  it('uses functional names for topbar and includes kanbo', () => {
    expect(moduleRooms.feed.name).toBe('订阅')
    expect(moduleRooms.music.name).toBe('音乐')
    expect(moduleRooms.forum.name).toBe('论坛')
    expect(moduleRooms.kanbo.name).toBe('刊播')
  })

  it('orders topbar rooms as 订阅 -> 刊播 -> 音乐 -> 论坛', () => {
    expect(moduleNavOrder.slice(0, 4)).toEqual(['feed', 'kanbo', 'music', 'forum'])
  })
})
