import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const artistsViewSource = readFileSync(resolve(__dirname, '../../../../src/views/music/ArtistsView.vue'), 'utf8')

function getBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = artistsViewSource.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`, 'm'))
  return match?.[1] ?? ''
}

describe('Music ArtistsView layout', () => {
  it('keeps a visible vertical gap between the toolbar and artist cards', () => {
    const block = getBlock('.artist-results-grid')
    expect(block).toContain('margin-top: 1.5rem;')
  })
})
