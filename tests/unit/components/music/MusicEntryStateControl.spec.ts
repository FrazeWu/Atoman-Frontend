import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/music/MusicEntryStateControl.vue'),
  'utf8',
)

describe('MusicEntryStateControl.vue', () => {
  it('does not render structural separators around the status row', () => {
    expect(source).not.toMatch(/\.music-entry-state\s*\{[^}]*border-block:/)
  })
})
