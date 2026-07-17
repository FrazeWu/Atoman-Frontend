import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const musicHomeSource = readFileSync(resolve(__dirname, '../../../src/views/music/HomeView.vue'), 'utf8')

describe('Music Home room name', () => {
  it('uses the functional music page title', () => {
    expect(musicHomeSource).toContain('page-title="专辑"')
    expect(musicHomeSource).toContain('content-mode="albums"')
    expect(musicHomeSource).not.toContain('藏音')
  })
})
