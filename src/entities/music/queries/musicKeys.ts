export const musicKeys = {
  all: ['music'] as const,
  songs: () => [...musicKeys.all, 'songs'] as const,
  song: (id: string | number) => [...musicKeys.songs(), String(id)] as const,
  songDetail: (id: string | number) => [...musicKeys.songs(), 'detail', String(id)] as const,
  lyrics: (songId: string | number) => [...musicKeys.song(songId), 'lyrics'] as const,
  albums: () => [...musicKeys.all, 'albums'] as const,
  album: (id: string | number) => [...musicKeys.albums(), String(id)] as const,
  albumDetail: (id: string | number) => [...musicKeys.albums(), 'detail', String(id)] as const,
  artists: () => [...musicKeys.all, 'artists'] as const,
  artist: (id: string | number) => [...musicKeys.artists(), String(id)] as const,
  artistDetail: (id: string | number) => [...musicKeys.artists(), 'detail', String(id)] as const,
}

