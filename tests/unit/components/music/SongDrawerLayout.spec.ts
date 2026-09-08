import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/music/SongDrawer.vue'),
  'utf8',
)

describe('SongDrawer 单曲详情布局', () => {
  it('将播放和编辑操作组放在封面与单曲信息之后', () => {
    expect(source).toContain('class="song-detail__actions song-detail__actions--primary"')
    expect(source).toMatch(/<\/div>\s*<div class="song-detail__actions song-detail__actions--primary">/)
    expect(source).toContain('data-testid="song-detail-play"')
    expect(source).toContain('data-testid="song-detail-edit"')
  })

  it('不在单曲详情页提供稍后播放入口', () => {
    expect(source).not.toContain('addMusicSongToLater')
    expect(source).not.toContain('稍后播放')
    expect(source).not.toContain('Clock3')
  })

  it('详情歌词关闭时间轴和 hover 效果', () => {
    expect(source).toContain(':show-timeline="false"')
    expect(source).toContain(':disable-hover-effects="true"')
  })

  it('详情歌词和注释区域交给外层页面滚动', () => {
    expect(source).not.toContain('max-height: 32rem')
    expect(source).not.toContain('overflow-y: auto')
    expect(source).toContain('grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem)')
  })

  it('详情歌词使用紧凑行距，便于连续选择多行', () => {
    expect(source).toContain(':deep(.music-lyrics-line) { opacity: 1; padding: 0.2rem 0; }')
    expect(source).toContain(':deep(.music-lyrics-line__text) { font-size: 1rem; line-height: 1.45; }')
    expect(source).toContain('.song-detail__lyric-lines { display: grid; gap: 0; }')
  })

  it('提供复制单曲 UUID 的操作', () => {
    expect(source).toContain('data-testid="song-detail-copy-uuid"')
    expect(source).toContain('@click="copySongUuid"')
    expect(source).toContain('UUID 已复制')
  })
})
