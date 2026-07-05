import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const layoutFiles = [
  '../../../src/views/media/MediaLayout.vue',
  '../../../src/views/video/VideoLayout.vue',
  '../../../src/views/blog/BlogLayout.vue',
  '../../../src/views/podcast/PodcastLayout.vue',
] as const

describe('content layouts without extra sidebars', () => {
  it('keeps podcast, video, paper related layouts free of PSidebar wrappers', () => {
    for (const filePath of layoutFiles) {
      const source = readFileSync(resolve(__dirname, filePath), 'utf8')
      expect(source).not.toContain('<PSidebar')
      expect(source).not.toContain("from '@/components/ui/PSidebar.vue'")
    }
  })
})
