import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const layoutSource = readFileSync(resolve(__dirname, '../../../../src/views/video/VideoLayout.vue'), 'utf8')

describe('VideoLayout', () => {
  it('keeps video sidebar links under the videos module prefix', () => {
    expect(layoutSource).toContain('to="/videos"')
    expect(layoutSource).toContain('to="/videos/subscriptions"')
    expect(layoutSource).toContain('to="/videos/manage"')
  })
})
