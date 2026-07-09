import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(__dirname, '../../../../src/views/music/ExploreView.vue'), 'utf8')

function getBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`, 'm'))
  return match?.[1] ?? ''
}

describe('Music ExploreView layout', () => {
  it('does not keep oversized discover-card variants', () => {
    expect(getBlock('.discover-layout__item--album-hero')).toBe('')
    expect(getBlock('.discover-layout__item--album-hero :deep(.cover-frame)')).toBe('')
    expect(getBlock('.discover-layout__item--playlist-tall :deep(.cover-frame)')).toBe('')
    expect(getBlock('.discover-layout__item--playlist-compact :deep(.cover-frame)')).toBe('')
    expect(getBlock('.discover-layout__item--artist :deep(.avatar-frame)')).toBe('')
  })
})
