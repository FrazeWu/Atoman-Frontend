import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/composables/useMediaOverview.ts'), 'utf8')

describe('useMediaOverview source', () => {
  it('uses shared raw get helpers for the overview fan-out requests', () => {
    expect(source).toContain("from '@/api/client'")
    expect(source).toContain('apiGetRaw<Post[] | { data?: Post[] }>')
    expect(source).toContain('apiGetRaw<PodcastEpisode[] | { data?: PodcastEpisode[]; episodes?: PodcastEpisode[] }>')
    expect(source).toContain('apiGetRaw<Video[] | { data?: Video[] }>')
    expect(source).not.toContain('fetch(articleUrl)')
    expect(source).not.toContain('fetch(podcastUrl)')
    expect(source).not.toContain('fetch(videoUrl)')
  })
})
