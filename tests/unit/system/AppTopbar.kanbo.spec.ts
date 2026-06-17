import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { moduleNavOrder, moduleRooms } from '@/config/moduleRooms'

const topbarSource = readFileSync(resolve(__dirname, '../../../src/components/system/AppTopbar.vue'), 'utf8')

describe('AppTopbar functional nav labels', () => {
  it('uses 订阅 / 刊播 / 音乐 / 论坛 as first nav items and removes blog-only links', () => {
    expect(moduleNavOrder.slice(0, 4).map((key) => moduleRooms[key].name)).toEqual(['订阅', '刊播', '音乐', '论坛'])
    expect(topbarSource).not.toContain('isBlogContext')
    expect(topbarSource).not.toContain('canCreatePost')
    expect(topbarSource).not.toContain('写文章')
    expect(topbarSource).not.toContain('发现')
    expect(Object.values(moduleRooms).map((room) => room.name)).not.toContain('山门')
    expect(Object.values(moduleRooms).map((room) => room.name)).not.toContain('法堂')
  })
})
