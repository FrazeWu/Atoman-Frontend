import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('music shell matches the established design system', () => {
  it('uses the shared application sidebar and music sheet stack', () => {
    const source = read('src/views/music/MusicLayout.vue')

    expect(source).toContain('<AppSidebar module="music" />')
    expect(source).toContain('<MusicSheetStack />')
    expect(source).toContain('useSidebar')
    expect(source).not.toContain('<PSidebar')
  })

  it('keeps the sidebar toggle in the global topbar', () => {
    const source = read('src/components/system/AppTopbar.vue')

    expect(source).toContain('class="topbar-collapse-btn"')
    expect(source).toContain('v-if="hasSidebar && !isAuthRoute"')
    expect(source).toContain('useSidebar')
  })

  it('uses the soft segmented control instead of a black outlined control', () => {
    const source = read('src/components/ui/PSegmentedControl.vue')

    expect(source).toMatch(/\.p-segmented-control\s*\{[\s\S]*?background:\s*var\(--a-color-surface-muted\)/)
    expect(source).toMatch(/\.p-segmented-control\s*\{[\s\S]*?border:\s*none/)
    expect(source).toMatch(/\.p-segmented-control-indicator\s*\{[\s\S]*?background:\s*var\(--a-color-bg\)/)
    expect(source).not.toMatch(/\.p-segmented-control-item--active\s*\{[\s\S]*?background:\s*var\(--a-color-(?:fg|text)\)/)
  })

  it('keeps the artist filters and responsive card sizing from the reference UI', () => {
    const source = read('src/views/music/ArtistsView.vue')

    expect(source).toContain("{ label: '全部', value: 'all' }")
    expect(source).toContain("{ label: '已订阅', value: 'subscribed' }")
    expect(source).toContain(':options="MUSIC_RECOMMENDATION_MODE_OPTIONS"')
    expect(source).toMatch(/\.artist-results-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/)
    expect(source).toMatch(/@media \(max-width: 720px\)\s*\{[\s\S]*?\.artist-results-grid\s*\{[\s\S]*?repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  })

  it('uses shared color tokens throughout the music creation flow', () => {
    const drawer = read('src/components/music/MusicCreationFlowDrawer.vue')
    const albumImport = read('src/components/music/MusicCreationAlbumSeedStep.vue')
    const albumDetails = read('src/components/music/MusicCreationAlbumDetailsStep.vue')

    expect(drawer).toContain('background: var(--a-color-bg) !important')
    expect(drawer).not.toContain('rgba(255, 255, 255, 0.85)')
    expect(drawer).not.toContain('rgba(15, 23, 42, 0.88)')
    expect(albumImport).not.toContain('--color-')
    expect(albumDetails).not.toContain('#6b4f3a')
    expect(albumDetails).not.toContain('rgba(15, 23, 42, 0.03)')
  })
})
