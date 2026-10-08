import type { MusicCreationTrackDraft } from '@/components/music/musicCreationTypes'

export function musicTrackLyricsLabel(track: MusicCreationTrackDraft, importStatus?: string) {
  if ((track.lyricsDraft?.content ?? track.lyrics ?? '').trim()) {
    if (track.lyricsSource === 'local') return '本地歌词'
    if (track.lyricsSource === 'lrclib') return '已匹配歌词'
    return '已添加歌词'
  }
  if (track.origin !== 'manual' && importStatus && !['ready', 'committed', 'needs_attention', 'failed', 'canceled'].includes(importStatus)) {
    return '歌词待处理'
  }
  return '暂无歌词'
}
