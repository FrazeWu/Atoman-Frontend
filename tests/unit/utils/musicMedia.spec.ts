import { describe, expect, it } from 'vitest'
import { buildPlayableSongsFromAlbum } from '@/utils/musicMedia'

describe('musicMedia', () => {
  it('orders playable tracks by disc number and then track number', () => {
    const songs = buildPlayableSongsFromAlbum({
      id: 'album-1',
      title: 'Multi Disc',
      entry_status: 'open',
      songs: [
        { id: 'd2t1', title: 'Disc 2 Track 1', disc_number: 2, track_number: 1, audio_url: '/d2t1.mp3' },
        { id: 'd1t2', title: 'Disc 1 Track 2', disc_number: 1, track_number: 2, audio_url: '/d1t2.mp3' },
        { id: 'd1t1', title: 'Disc 1 Track 1', disc_number: 1, track_number: 1, audio_url: '/d1t1.mp3' },
      ],
    })

    expect(songs.map((song) => song.id)).toEqual(['d1t1', 'd1t2', 'd2t1'])
  })
})
