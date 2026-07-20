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

  it('仅空白差异且原选区仍匹配时不计入影响', () => {
    const lyrics: MusicSongLyrics = {
      ...currentLyrics,
      content: 'Hello world',
      translation: '',
      lines: [{ line_key: 'line-hello', line_index: 0, text: 'Hello world', translation: '' }],
      annotations: [{
        id: 'annotation-hello', line_key: 'line-hello', selected_text: 'Hello', start_offset: 0, end_offset: 5,
        body: '', upvotes: 0, downvotes: 0, status: 'active', created_at: '', updated_at: '',
      }],
    }

    const preview = buildMusicLyricsVersionPreview(lyrics, version('Hello  world'))

    expect(preview.affectedActiveAnnotationCount).toBe(0)
  })

  it('LRC 时间戳变化时显示修改并计入 active 注释影响', () => {
    const lyrics: MusicSongLyrics = {
      ...currentLyrics,
      format: 'lrc',
      content: '[00:01.00]Hello',
      translation: '',
      lines: [{ line_key: 'line-lrc', line_index: 0, time_ms: 1_000, text: 'Hello', translation: '' }],
      annotations: [{
        id: 'annotation-lrc', line_key: 'line-lrc', selected_text: 'Hello', start_offset: 0, end_offset: 5,
        body: '', upvotes: 0, downvotes: 0, status: 'active', created_at: '', updated_at: '',
      }],
    }

    const preview = buildMusicLyricsVersionPreview(lyrics, { ...version('[00:02.00]Hello'), format: 'lrc' })

    expect(preview.lines.map((line) => line.kind)).toEqual(['modified'])
    expect(preview.affectedActiveAnnotationIds).toEqual(['annotation-lrc'])
  })

  it('plain 预览保留中间空行并兼容 CRLF', () => {
    const lyrics: MusicSongLyrics = {
      ...currentLyrics,
      content: 'A\n\nB',
      translation: '',
      lines: [
        { line_key: 'line-a', line_index: 0, text: 'A', translation: '' },
        { line_key: 'line-empty', line_index: 1, text: '', translation: '' },
        { line_key: 'line-b', line_index: 2, text: 'B', translation: '' },
      ],
      annotations: [],
    }

    const preview = buildMusicLyricsVersionPreview(lyrics, version('A\r\n\r\nB\r\n'))

    expect(preview.lines.map((line) => line.kind)).toEqual(['unchanged', 'unchanged', 'unchanged'])
  })

  it('plain 预览兼容裸 CR 换行', () => {
    const lyrics: MusicSongLyrics = {
      ...currentLyrics,
      content: 'A\nB',
      translation: '',
      lines: [
        { line_key: 'line-a', line_index: 0, text: 'A', translation: '' },
        { line_key: 'line-b', line_index: 1, text: 'B', translation: '' },
      ],
      annotations: [],
    }

    const preview = buildMusicLyricsVersionPreview(lyrics, version('A\rB\r'))

    expect(preview.lines.map((line) => line.kind)).toEqual(['unchanged', 'unchanged'])
  })

  it('纯翻译变化只展示差异，不影响 active 注释', () => {
    const preview = buildMusicLyricsVersionPreview(currentLyrics, version(
      currentLyrics.content,
      '改过的第一句\n改过的第二句\n改过的第三句\n改过的第四句',
    ))

    expect(preview.lines.some((line) => line.kind === 'modified')).toBe(true)
    expect(preview.affectedActiveAnnotationCount).toBe(0)
  })

  it('跨格式版本不配对并使所有 active 注释受影响', () => {
    const lyrics: MusicSongLyrics = {
      ...currentLyrics,
      format: 'lrc',
      content: '[00:01.00]Hello',
      translation: '',
      lines: [{ line_key: 'line-lrc', line_index: 0, time_ms: 1_000, text: 'Hello', translation: '' }],
      annotations: [{
        id: 'annotation-cross-format', line_key: 'line-lrc', selected_text: 'Hello', start_offset: 0, end_offset: 5,
        body: '', upvotes: 0, downvotes: 0, status: 'active', created_at: '', updated_at: '',
      }],
    }

    const preview = buildMusicLyricsVersionPreview(lyrics, version('Hello'))

    expect(preview.lines.map((line) => line.kind)).toEqual(['removed', 'added'])
    expect(preview.affectedActiveAnnotationIds).toEqual(['annotation-cross-format'])
  })

  it('LRC 预览接受单数字分钟', () => {
    const lyrics: MusicSongLyrics = {
      ...currentLyrics,
      format: 'lrc',
      content: '[01:02]Hello',
      translation: '',
      lines: [{ line_key: 'line-lrc', line_index: 0, time_ms: 62_000, text: 'Hello', translation: '' }],
      annotations: [],
    }

    const preview = buildMusicLyricsVersionPreview(lyrics, { ...version('[1:02]Hello'), format: 'lrc' })

    expect(preview.lines.map((line) => line.kind)).toEqual(['unchanged'])
  })

  it('LRC 预览保留非时间顺序的物理行顺序', () => {
    const lyrics: MusicSongLyrics = {
      ...currentLyrics,
      format: 'lrc',
      content: '[00:02]Later\n[00:01]Earlier',
      translation: '',
      lines: [
        { line_key: 'line-later', line_index: 0, time_ms: 2_000, text: 'Later', translation: '' },
        { line_key: 'line-earlier', line_index: 1, time_ms: 1_000, text: 'Earlier', translation: '' },
      ],
      annotations: [],
    }

    const preview = buildMusicLyricsVersionPreview(lyrics, { ...version('[00:02]Later\n[00:01]Earlier'), format: 'lrc' })

    expect(preview.lines.map((line) => line.target?.text)).toEqual(['Later', 'Earlier'])
    expect(preview.lines.map((line) => line.kind)).toEqual(['unchanged', 'unchanged'])
  })

  it('plain 重复归一化文本按 occurrence 配对，不误报增删或注释影响', () => {
    const lyrics: MusicSongLyrics = {
      ...currentLyrics,
      format: 'plain',
      content: 'Hello world\nHello  world',
      translation: '',
      lines: [
        { line_key: 'line-hello-0', line_index: 0, text: 'Hello world', translation: '' },
        { line_key: 'line-hello-1', line_index: 1, text: 'Hello  world', translation: '' },
      ],
      annotations: [{
        id: 'annotation-plain-repeat', line_key: 'line-hello-1', selected_text: 'Hello', start_offset: 0, end_offset: 5,
        body: '', upvotes: 0, downvotes: 0, status: 'active', created_at: '', updated_at: '',
      }],
    }

    const preview = buildMusicLyricsVersionPreview(lyrics, version('Hello  world\nHello world'))

    expect(preview.lines.map((line) => line.kind)).not.toContain('added')
    expect(preview.lines.map((line) => line.kind)).not.toContain('removed')
    expect(preview.affectedActiveAnnotationCount).toBe(0)
  })

  it('同时间戳的 LRC 重复归一化文本按 occurrence 配对，不误报增删或注释影响', () => {
    const lyrics: MusicSongLyrics = {
      ...currentLyrics,
      format: 'lrc',
      content: '[00:01]Hello world\n[00:01]Hello  world',
      translation: '',
      lines: [
        { line_key: 'line-lrc-0', line_index: 0, time_ms: 1_000, text: 'Hello world', translation: '' },
        { line_key: 'line-lrc-1', line_index: 1, time_ms: 1_000, text: 'Hello  world', translation: '' },
      ],
      annotations: [{
        id: 'annotation-lrc-repeat', line_key: 'line-lrc-1', selected_text: 'Hello', start_offset: 0, end_offset: 5,
        body: '', upvotes: 0, downvotes: 0, status: 'active', created_at: '', updated_at: '',
      }],
    }

    const preview = buildMusicLyricsVersionPreview(lyrics, { ...version('[00:01]Hello  world\n[00:01]Hello world'), format: 'lrc' })

    expect(preview.lines.map((line) => line.kind)).not.toContain('added')
    expect(preview.lines.map((line) => line.kind)).not.toContain('removed')
    expect(preview.affectedActiveAnnotationCount).toBe(0)
  })

  it('内容和翻译都未变化时不产生差异', () => {
    const preview = buildMusicLyricsVersionPreview(currentLyrics, version(currentLyrics.content, currentLyrics.translation))

    expect(preview.lines.every((line) => line.kind === 'unchanged')).toBe(true)
    expect(preview.affectedActiveAnnotationCount).toBe(0)
  })
})
