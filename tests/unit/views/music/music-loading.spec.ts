import path from 'node:path'
import { readFileSync } from 'node:fs'

const musicAlbumsSource = readFileSync(
  path.resolve(process.cwd(), 'src/views/music/AlbumsView.vue'),
  'utf8',
)
const musicDiscoverSource = readFileSync(
  path.resolve(process.cwd(), 'src/views/music/DiscoverView.vue'),
  'utf8',
)

const playerStoreSource = readFileSync(
  path.resolve(process.cwd(), 'src/stores/player.ts'),
  'utf8',
)

describe('music loading boundaries', () => {
  it('keeps the music home view as a thin shell and leaves album loading to DiscoverView', () => {
    expect(musicAlbumsSource).not.toContain('player.fetchSongs()')
    expect(musicAlbumsSource).toContain('<DiscoverView page-title="专辑" content-mode="albums" />')
    expect(musicDiscoverSource).toContain('listMusicDiscoverFeed')
    expect(musicDiscoverSource).toContain('listMusicAlbums')
  })

  it('keeps the player audio element lazily created', () => {
    expect(playerStoreSource).not.toContain('const audio = new Audio()')
    expect(playerStoreSource).toContain('const ensureAudio = () =>')
  })
})
