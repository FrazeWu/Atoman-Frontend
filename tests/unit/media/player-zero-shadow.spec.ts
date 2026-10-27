import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Player Zero-Shadow and Semantic Tokenization', () => {
  const audioVolumePath = path.resolve(__dirname, '../../../src/components/music/AudioPlayerVolume.vue')
  const videoControlsPath = path.resolve(__dirname, '../../../src/components/video/VideoPlayerControls.vue')

  it('eliminates box-shadow and hardcoded colors from AudioPlayerVolume.vue', () => {
    const content = fs.readFileSync(audioVolumePath, 'utf-8')

    // Slider thumb should not have box-shadow
    expect(content).not.toMatch(/box-shadow:\s*0\s+1px\s+3px/)

    // Slider thumb background should use semantic token instead of #ffffff
    expect(content).toMatch(/background:\s*var\(--a-color-surface\);/)
  })

  it('eliminates box-shadow from VideoPlayerControls.vue scrubber handle and popovers', () => {
    const content = fs.readFileSync(videoControlsPath, 'utf-8')

    // Scrubber handle should not use blur box-shadow
    expect(content).not.toMatch(/\.vpc-scrubber-handle\s*\{[^}]*box-shadow:\s+(?!none\b)/)

    // Preview tooltip should not use blur box-shadow
    expect(content).not.toMatch(/\.vpc-preview\s*\{[^}]*box-shadow:\s+(?!none\b)/)

    // Speed popover should not use blur box-shadow
    expect(content).not.toMatch(/\.vpc-speed-menu\s*\{[^}]*box-shadow:\s+(?!none\b)/)
  })
})
