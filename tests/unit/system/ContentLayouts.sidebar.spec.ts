import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sidebarLayouts = [
  '../../../src/views/video/VideoLayout.vue',
  '../../../src/views/blog/BlogLayout.vue',
  '../../../src/views/podcast/PodcastLayout.vue',
] as const

const redirectLayouts = [
  '../../../src/views/media/MediaLayout.vue',
] as const

describe('content layout shells', () => {
  it('restores sidebars for blog, podcast and video modules', () => {
    for (const filePath of sidebarLayouts) {
      const source = readFileSync(resolve(__dirname, filePath), 'utf8')
      expect(source).toContain('<PSidebar')
      expect(source).toContain("from '@/components/ui/PSidebar.vue'")
    }
  })

  it('keeps media layout as a thin redirect shell without PSidebar', () => {
    for (const filePath of redirectLayouts) {
      const source = readFileSync(resolve(__dirname, filePath), 'utf8')
      expect(source).not.toContain('<PSidebar')
    }
  })
})
