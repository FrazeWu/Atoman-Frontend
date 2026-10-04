import { describe, expect, it } from 'vitest'

import { buildPrefetchCandidates, shufflePlaybackItems } from '@/utils/playerQueue'

const song = (id: string, audio_url = `/${id}.mp3`) => ({ id, title: id, audio_url }) as any

describe('player queue helpers', () => {
  it('shuffles deterministically with an injected random source', () => {
    expect(shufflePlaybackItems(['a', 'b', 'c'], () => 0)).toEqual(['b', 'c', 'a'])
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
