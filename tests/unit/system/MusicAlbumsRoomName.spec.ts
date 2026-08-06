import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const musicAlbumsSource = readFileSync(resolve(__dirname, '../../../src/views/music/AlbumsView.vue'), 'utf8')
const musicDiscoverSource = readFileSync(resolve(__dirname, '../../../src/views/music/DiscoverView.vue'), 'utf8')

describe('Music Home room name', () => {
  it('uses the functional music page title', () => {
    expect(musicAlbumsSource).toContain('<DiscoverView page-title="专辑" content-mode="albums" />')
    expect(musicDiscoverSource).toContain("pageTitle: '发现'")
    expect(musicAlbumsSource).not.toContain('藏音')
  })
})
