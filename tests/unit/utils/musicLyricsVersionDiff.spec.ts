import { describe, expect, it } from 'vitest'
import type { MusicSongLyrics, MusicSongLyricsVersion } from '@/api/musicV1'
import { buildMusicLyricsVersionPreview } from '@/utils/musicLyricsVersionDiff'

const currentLyrics: MusicSongLyrics = {
  id: 'lyrics-1',
  song_id: 'song-1',
  format: 'plain',
  content: 'First line\nSecond line\nThird line\nFourth line',
  translation: '第一句\n第二句\n第三句\n第四句',
  edit_summary: 'current',
  updated_at: '2026-07-20T00:00:00Z',
  version: 4,
  lines: [
    { line_key: 'line-1', line_index: 0, text: 'First line', translation: '第一句' },
    { line_key: 'line-2', line_index: 1, text: 'Second line', translation: '第二句' },
    { line_key: 'line-3', line_index: 2, text: 'Third line', translation: '第三句' },
    { line_key: 'line-4', line_index: 3, text: 'Fourth line', translation: '第四句' },
  ],
  annotations: [
    {
      id: 'annotation-stays', line_key: 'line-1', selected_text: 'First', start_offset: 0, end_offset: 5,
      body: '', upvotes: 0, downvotes: 0, status: 'active', created_at: '', updated_at: '',
    },
    {
      id: 'annotation-breaks', line_key: 'line-2', selected_text: 'Second', start_offset: 0, end_offset: 6,
      body: '', upvotes: 0, downvotes: 0, status: 'active', created_at: '', updated_at: '',
    },
    {
      id: 'annotation-pending', line_key: 'line-3', selected_text: 'Third', start_offset: 0, end_offset: 5,
      body: '', upvotes: 0, downvotes: 0, status: 'needs_rebind', created_at: '', updated_at: '',
    },
  ],
}

function version(content: string, translation = ''): MusicSongLyricsVersion {
  return {
    id: 'version-2', song_id: 'song-1', version: 2, content, translation, format: 'plain',
    edit_summary: 'old', created_at: '', created_by: 'user-1',
  }
}

describe('buildMusicLyricsVersionPreview', () => {
  it('逐行标出相对当前版本的新增、删除和修改', () => {
    const preview = buildMusicLyricsVersionPreview(currentLyrics, version(
      'First line\nChanged line\nFourth line\nInserted line',
      '第一句\n改过的第二句\n第四句\n新增句',
    ))

    expect(preview.lines.map((line) => line.kind)).toEqual(['unchanged', 'modified', 'removed', 'unchanged', 'added'])
    expect(preview.lines[1]).toMatchObject({ current: { text: 'Second line' }, target: { text: 'Changed line' } })
    expect(preview.lines[2]).toMatchObject({ current: { text: 'Third line' } })
    expect(preview.lines[4]).toMatchObject({ target: { text: 'Inserted line' } })
  })

  it('仅统计目标版本中锚点失效的 active 注释', () => {
    const preview = buildMusicLyricsVersionPreview(currentLyrics, version(
      'First line\nChanged line\nThird line\nFourth line',
      '第一句\n改过的第二句\n第三句\n第四句',
    ))

    expect(preview.affectedActiveAnnotationCount).toBe(1)
    expect(preview.affectedActiveAnnotationIds).toEqual(['annotation-breaks'])
  })

  it('配对行文本改变时即使原选区和偏移仍能匹配也计为受影响', () => {
    const lyrics: MusicSongLyrics = {
      ...currentLyrics,
      content: 'Hello world',
      translation: '',
      lines: [{ line_key: 'line-hello', line_index: 0, text: 'Hello world', translation: '' }],
      annotations: [{
        id: 'annotation-world', line_key: 'line-hello', selected_text: 'world', start_offset: 6, end_offset: 11,
        body: '', upvotes: 0, downvotes: 0, status: 'active', created_at: '', updated_at: '',
      }],
    }

    const preview = buildMusicLyricsVersionPreview(lyrics, version('Hi!   world'))

    expect(preview.affectedActiveAnnotationIds).toEqual(['annotation-world'])
  })

  it('内容和翻译都未变化时不产生差异', () => {
    const preview = buildMusicLyricsVersionPreview(currentLyrics, version(currentLyrics.content, currentLyrics.translation))

    expect(preview.lines.every((line) => line.kind === 'unchanged')).toBe(true)
    expect(preview.affectedActiveAnnotationCount).toBe(0)
  })
})
