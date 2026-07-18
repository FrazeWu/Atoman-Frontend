import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('podcast and video creator UI contract', () => {
  it('provides a shared creation step component', () => {
    expect(existsSync(resolve(root, 'src/components/ui/PCreationSteps.vue'))).toBe(true)
  })

  it.each([
    'src/views/video/VideoEditorView.vue',
    'src/views/podcast/PodcastEditorView.vue',
  ])('uses the shared three-step flow in %s', (path) => {
    const source = read(path)

    expect(source).toContain("import PCreationSteps from '@/components/ui/PCreationSteps.vue'")
    expect(source).toContain('<PCreationSteps')
    expect(source).toContain("label: '媒体'")
    expect(source).toContain("label: '信息'")
    expect(source).toContain("label: '发布'")
  })

  it.each([
    'src/components/video/VideoCoverPanel.vue',
    'src/components/podcast/PodcastCoverPanel.vue',
  ])('keeps cover presentation styles inside %s', (path) => {
    const source = read(path)

    expect(source).toContain('<style scoped>')
    expect(source).toMatch(/\.\w+-cover-empty\s*\{/)
    expect(source).toContain('var(--a-radius-control)')
  })

  it.each([
    'src/views/video/VideoEditorView.vue',
    'src/views/podcast/PodcastEditorView.vue',
  ])('keeps mobile publish actions above the bottom navigation in %s', (path) => {
    const source = read(path)

    expect(source).toContain('bottom: var(--a-mobile-nav-reserved-height)')
  })

  it('renders the podcast home as a modern media surface', () => {
    const source = read('src/views/podcast/PodcastHomeView.vue')

    expect(source).not.toMatch(/\bPEntry\b/)
    expect(source).not.toMatch(/\bPBadge\b/)
    expect(source).not.toMatch(/\bPPress\b/)
    expect(source).toContain('ph-episode-row')
    expect(source).toContain('ph-recommendation-grid')
  })
})
