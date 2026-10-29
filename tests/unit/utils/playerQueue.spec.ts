import { describe, expect, it } from 'vitest'

import { buildPrefetchCandidates, shufflePlaybackItems } from '@/utils/playerQueue'

const song = (id: string, audio_url = `/${id}.mp3`) => ({ id, title: id, audio_url }) as any

describe('player queue helpers', () => {
  it('shuffles deterministically with an injected random source', () => {
    expect(shufflePlaybackItems(['a', 'b', 'c'], () => 0)).toEqual(['b', 'c', 'a'])
  })

  it('limits a long playlist to the next three prefetch candidates', () => {
    const list = Array.from({ length: 120 }, (_, index) => song('track-' + index))
    expect(buildPrefetchCandidates(
      list, 'music:track-59', (url) => url, () => true, new Set(),
    )).toEqual(['/track-60.mp3', '/track-61.mp3', '/track-62.mp3'])
  })

  it('skips unavailable media and avoids duplicates while prefetching', () => {
    const list = [
      song('earlier'), song('current'), song('processing'),
      song('next'), song('next-duplicate', '/next.mp3'),
      song('later'), song('last'),
    ]
    expect(buildPrefetchCandidates(
      list, 'music:current', (url) => url,
      (s) => s.id !== 'processing', new Set(),
    )).toEqual(['/next.mp3', '/later.mp3', '/last.mp3'])
  })

  it('builds unique playable prefetch candidates while excluding current and cached URLs', () => {
    const candidates = buildPrefetchCandidates(
      [song('current'), song('next'), song('duplicate', '/next.mp3')],
      'music:current',
      (url) => `https://cdn.test${url}`,
      () => true,
      new Set(['https://cdn.test/duplicate.mp3']),
    )

    expect(candidates).toEqual(['https://cdn.test/next.mp3'])
  })
})
