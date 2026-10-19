import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { moduleSongDetailCache } from '@/components/music/SongDrawer.vue'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/music/SongDrawer.vue'),
  'utf8',
)

describe('SongDrawer 缓存与查询优化', () => {
  it('移除了未使用的 useSongQuery，消除重复请求', () => {
    expect(source).not.toContain('useSongQuery')
    expect(source).not.toContain('songQuery =')
  })

  it('引入了 moduleSongDetailCache 模块级缓存避免重新打开时闪烁加载', () => {
    expect(source).toContain('moduleSongDetailCache')
    expect(moduleSongDetailCache).toBeInstanceOf(Map)
  })

  it('集成了 Vue Query 查询客户端并在请求前后进行缓存读取与设置', () => {
    expect(source).toContain('useQueryClient')
    expect(source).toContain('fetchSongDetail')
    expect(source).toContain('queryClient?.getQueryData')
    expect(source).toContain('queryClient?.setQueryData')
  })

  it('在评分更新时同步更新模块缓存和 Vue Query 缓存', () => {
    expect(source).toMatch(/moduleSongDetailCache\.set\(.*,\s*detail\.value\)/)
    expect(source).toMatch(/queryClient\?\.setQueryData\(.*,\s*detail\.value\)/)
  })

  it('在 songRefreshToken 变化时清除缓存并触发查询失效', () => {
    expect(source).toContain('moduleSongDetailCache.delete(targetSongId)')
    expect(source).toContain('queryClient?.invalidateQueries')
  })
})
