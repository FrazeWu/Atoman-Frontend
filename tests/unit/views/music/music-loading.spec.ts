import path from 'node:path'
import { readFileSync } from 'node:fs'

const musicHomeSource = readFileSync(
  path.resolve(process.cwd(), 'src/views/music/HomeView.vue'),
  'utf8',
)
const musicExploreSource = readFileSync(
  path.resolve(process.cwd(), 'src/views/music/ExploreView.vue'),
  'utf8',
)

const playerStoreSource = readFileSync(
  path.resolve(process.cwd(), 'src/stores/player.ts'),
  'utf8',
)

describe('music loading boundaries', () => {
  it('keeps the music home view as a thin shell and leaves album loading to ExploreView', () => {
    expect(musicHomeSource).not.toContain('player.fetchSongs()')
    expect(musicHomeSource).toContain('<ExploreView page-title="专辑" />')
    expect(musicExploreSource).toContain('listMusicDiscoverFeed')
  })

  it('keeps the player audio element lazily created', () => {
    expect(playerStoreSource).not.toContain('const audio = new Audio()')
    expect(playerStoreSource).toContain('const ensureAudio = () =>')
  })
})
