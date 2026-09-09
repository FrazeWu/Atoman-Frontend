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
    expect(source).toContain('content-max-width="96rem"')
    expect(source).toContain('grid-template-columns: minmax(0, 1fr) minmax(16rem, 19rem);')
    expect(source).toContain('grid-template-columns: minmax(10rem, 16rem) minmax(0, 1fr);')
    expect(source).toContain('@container (max-width: 76.5rem)')
  })

  it('歌曲信息页不再保留独立歌词编辑入口，歌词编辑归入歌曲编辑器', () => {
    expect(source).not.toContain('data-testid="song-detail-edit-lyrics"')
    expect(source).not.toContain('MusicSongLyricsEditorDrawer')
  })

  it('允许已登录用户在详情页使用完整注释工作区', () => {
    expect(source).toContain(':can-select="authStore.isAuthenticated"')
    expect(source).toContain(':can-annotate="authStore.isAuthenticated"')
    expect(source).toContain('@select-text="handleSelectText"')
    expect(source).toContain('<MusicAnnotationWorkspace')
    expect(source).toContain('@vote="handleVoteAnnotation"')
    expect(source).toContain('@edit="handleEditAnnotation"')
    expect(source).toContain('@delete="handleDeleteAnnotation"')
    expect(source).toContain('@rebind="handleRebindAnnotation"')
  })

  it('消费歌曲层传入的注释焦点并自动进入重绑状态', () => {
    expect(source).toContain('focusAnnotationId')
    expect(source).toContain('startRebind')
    expect(source).toContain('handleRebindAnnotation(annotation)')
  })

  it('仅为 LRCLIB 自动匹配歌词显示来源与编辑状态', () => {
    expect(source).toContain("lyrics.value?.source === 'lrclib'")
    expect(source).toContain('LRCLIB')
    expect(source).toContain("lyrics.value?.is_edited ? '已编辑' : '已核验'")
    expect(source).toContain('https://lrclib.net/favicon.ico')
  })
})
