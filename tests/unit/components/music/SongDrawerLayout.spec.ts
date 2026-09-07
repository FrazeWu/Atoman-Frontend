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

  it('提供复制单曲 UUID 的操作', () => {
    expect(source).toContain('data-testid="song-detail-copy-uuid"')
    expect(source).toContain('@click="copySongUuid"')
    expect(source).toContain('UUID 已复制')
  })
})
