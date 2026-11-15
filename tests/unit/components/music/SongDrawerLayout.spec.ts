import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getSongEditorialNote } from '../../../../src/content/musicEditorialNotes'

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

  it('详情歌词与播放器解耦，仅作为纯文本注释区域', () => {
    expect(source).not.toContain('currentLyricLine')
    expect(source).not.toContain('activeLyricLineId')
    expect(source).not.toContain(':active=')
    expect(source).not.toContain('@seek="player.seek"')
    expect(source).toContain(':click-to-seek="false"')
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

  it('让小批量来源资料同时展示在歌曲详情和网页初始 HTML', () => {
    expect(source).toContain("getSongEditorialNote")
    expect(source).toContain('data-testid="song-editorial-note"')
    expect(source).toContain('参考来源：')
    expect(source).toContain('rel="noopener noreferrer"')
    expect(source).toContain('v-if="editorialNote"')
  })

  it('六首已核对曲目提供来源且拒绝专辑或名称不一致的旧注释', () => {
    const cases = [
      ['01a07774-5cc3-7d3a-af30-6611899f00fc', 'DNA.'],
      ['01a07774-5cb4-7c6f-b5df-841db6db86a2', 'HUMBLE.'],
      ['01a07774-5cea-71fd-b4f2-1d5058157f3f', 'ELEMENT.'],
      ['01a07774-5ce2-734c-bb0f-d5c4f76141e8', 'PRIDE.'],
      ['01a07774-5cd5-7394-ac29-df24632a1588', 'LOYALTY. (feat. Rihanna)'],
      ['01a07774-5d0a-70cd-a832-70943fb3acc0', 'FEEL.'],
    ] as const
    const albumId = '01a06b7f-0330-7f31-a440-b666a9722289'
    for (const [id, title] of cases) {
      const note = getSongEditorialNote(id, title, albumId)
      expect(note?.text.length).toBeGreaterThan(60)
      expect(note?.sources).toHaveLength(2)
      for (const item of note?.sources ?? []) {
        expect(new URL(item.href).protocol).toBe('https:')
      }
      expect(getSongEditorialNote(id, '不匹配名称', albumId)).toBeUndefined()
      expect(getSongEditorialNote(id, title, '01a17b88-ee76-77c9-afff-031387805123')).toBeUndefined()
    }
  })

  it('提供复制单曲 ID 的操作', () => {
    expect(source).toContain('data-testid="song-detail-copy-uuid"')
    expect(source).toContain('@click="copySongUuid"')
    expect(source).toContain('歌曲 ID 已复制')
  })
})
