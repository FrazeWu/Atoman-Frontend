import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { moduleRooms, topbarNavOrder } from '@/config/moduleRooms'

const topbarSource = readFileSync(resolve(__dirname, '../../../src/components/system/AppTopbar.vue'), 'utf8')

describe('AppTopbar functional nav labels', () => {
  it('uses 订阅 / 博客 / 音乐 / 视频 / 播客 / 辩论 / 时间线 as topbar nav items without media', () => {
    expect(topbarNavOrder.map((key) => moduleRooms[key].name)).toEqual(['订阅', '博客', '音乐', '视频', '播客', '辩论', '时间线'])
    expect(topbarNavOrder).not.toContain('media')
    expect(topbarSource).not.toContain('isBlogContext')
    expect(topbarSource).not.toContain('canCreatePost')
    expect(topbarSource).not.toContain('写文章')
    expect(topbarSource).not.toContain('发现')
    expect(Object.values(moduleRooms).map((room) => room.name)).not.toContain('山门')
    expect(Object.values(moduleRooms).map((room) => room.name)).not.toContain('法堂')
  })
})
