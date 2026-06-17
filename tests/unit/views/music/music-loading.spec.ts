import path from 'node:path'
import { readFileSync } from 'node:fs'

const musicHomeSource = readFileSync(
  path.resolve(process.cwd(), 'src/views/music/HomeView.vue'),
  'utf8',
)

const playerStoreSource = readFileSync(
  path.resolve(process.cwd(), 'src/stores/player.ts'),
  'utf8',
)

describe('music loading boundaries', () => {
  it('does not bootstrap songs from the music home view', () => {
    expect(musicHomeSource).not.toContain('player.fetchSongs()')
    expect(musicHomeSource).toContain('fetchAlbums()')
  })

  it('keeps the player audio element lazily created', () => {
    expect(playerStoreSource).not.toContain('const audio = new Audio()')
    expect(playerStoreSource).toContain('const ensureAudio = () =>')
  })
})
