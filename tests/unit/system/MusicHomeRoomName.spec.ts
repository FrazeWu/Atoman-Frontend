import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const musicHomeSource = readFileSync(resolve(__dirname, '../../../src/views/music/HomeView.vue'), 'utf8')
const musicExploreSource = readFileSync(resolve(__dirname, '../../../src/views/music/ExploreView.vue'), 'utf8')

describe('Music Home room name', () => {
  it('uses the functional music page title', () => {
    expect(musicHomeSource).toContain('<ExploreView page-title="专辑" />')
    expect(musicExploreSource).toContain("pageTitle: '发现'")
    expect(musicHomeSource).not.toContain('藏音')
  })
})
