import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const videoFiles = [
  'src/views/video/VideoEditorView.vue',
  'src/views/video/VideoDetailView.vue',
  'src/views/video/VideoManageView.vue',
  'src/views/video/VideoHomeView.vue',
  'src/views/video/VideoSubscriptionsView.vue',
  'src/views/video/VideoFavoritesView.vue',
  'src/components/shared/PVideoPlayerShell.vue',
]
const musicFiles = [
  'src/views/music/ArtistsView.vue',
  'src/views/music/ExploreView.vue',
  'src/views/music/StarredView.vue',
  'src/components/music/ArtistDrawer.vue',
  'src/components/music/AlbumDrawer.vue',
  'src/components/music/PlaylistDrawer.vue',
  'src/components/music/NestedActionDrawer.vue',
]

describe('module style contract', () => {
  it('keeps video surfaces flat, 4px, and headings at 500', () => {
    for (const path of videoFiles) {
      const source = read(path)
      expect(source, path).not.toMatch(/font-weight:\s*(700|800|900|950)/)
      expect(source, path).not.toMatch(/border-radius:\s*(8px|10px|12px|16px)/)
      expect(source, path).not.toMatch(/box-shadow:\s*(?:[1-9]|0\s+[1-9]|0\s+0\s+[1-9])/)
    }
  })

  it('keeps music surfaces flat, 4px, and free of hand-drawn icons', () => {
    for (const path of musicFiles) {
      const source = read(path)
      expect(source, path).not.toMatch(/font-weight:\s*(700|800|900|950)/)
      expect(source, path).not.toMatch(/border-radius:\s*(8px|10px|12px|16px|999px)/)
      expect(source, path).not.toMatch(/box-shadow:\s*(?:[1-9]|0\s+[1-9]|0\s+0\s+[1-9])/)
      expect(source, path).not.toContain('<svg')
    }
  })
})
