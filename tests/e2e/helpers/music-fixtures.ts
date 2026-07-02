export function buildMockMusicArtist() {
  return {
    id: 'artist-mock-1',
    name: 'Mock Artist',
    bio: 'Mock artist bio',
    entry_status: 'open',
    aliases: [],
    albums: [
      {
        id: 'album-mock-1',
        title: 'Mock Album',
        release_date: '2026-06-15',
        songs: [{ id: 'song-mock-1', title: 'Mock Track', track_number: 1 }],
        album_type: 'album',
        entry_status: 'open',
      },
    ],
  }
}

export function buildMockMusicArtistsResponse() {
  return {
    data: [buildMockMusicArtist()],
    meta: {
      page: 1,
      page_size: 20,
      total: 1,
      has_more: false,
    },
  }
}

export function buildMockMusicAlbumsResponse() {
  return {
    data: [
      {
        id: 'album-mock-1',
        title: 'Mock Album',
        release_date: '2026-06-15',
        songs: [{ id: 'song-mock-1', title: 'Mock Track', track_number: 1 }],
        album_type: 'album',
        entry_status: 'open',
      },
    ],
    meta: {
      page: 1,
      page_size: 20,
      total: 1,
      has_more: false,
    },
  }
}
