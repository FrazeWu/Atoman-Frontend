import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/music/SongDrawer.vue'),
  'utf8',
)

describe('SongDrawer 歌词注释入口', () => {
  it('将标签放在歌曲详情右侧栏，而不是详情主体整行', () => {
    expect(source).toContain('<div class="song-detail__primary">')
    expect(source).toContain('<aside class="song-detail__tags"')
    expect(source).toContain('.song-detail__content { display: grid; grid-template-columns: minmax(0, 1fr) minmax(16rem, 19rem);')
  })

  it('歌曲信息页不再保留独立歌词编辑入口，歌词编辑归入歌曲编辑器', () => {
    expect(source).not.toContain('data-testid="song-detail-edit-lyrics"')
    expect(source).not.toContain('MusicSongLyricsEditorDrawer')
  })

  it('允许已登录用户选择歌词，并在紧贴歌词的编辑区创建注释', () => {
    expect(source).toContain(':can-select="authStore.isAuthenticated"')
    expect(source).toContain(':can-annotate="authStore.isAuthenticated"')
    expect(source).toContain('@select-text="handleSelectText"')
    expect(source).toContain('class="song-detail__lyrics-layout"')
    expect(source).toContain('grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem)')
  })

  it('仅为 LRCLIB 自动匹配歌词显示来源与编辑状态', () => {
    expect(source).toContain("lyrics.value?.source === 'lrclib'")
    expect(source).toContain('LRCLIB')
    expect(source).toContain("lyrics.value?.is_edited ? '已编辑' : '已核验'")
    expect(source).toContain('https://lrclib.net/favicon.ico')
  })
})
