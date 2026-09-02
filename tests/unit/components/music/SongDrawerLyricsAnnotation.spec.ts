import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/music/SongDrawer.vue'),
  'utf8',
)

describe('SongDrawer 歌词注释入口', () => {
  it('允许已登录用户选择歌词，并在紧贴歌词的编辑区创建注释', () => {
    expect(source).toContain(':can-select="authStore.isAuthenticated"')
    expect(source).toContain(':can-annotate="authStore.isAuthenticated"')
    expect(source).toContain('@select-text="handleSelectText"')
    expect(source).toContain('class="song-detail__lyrics-layout"')
    expect(source).toContain('grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem)')
  })
})
