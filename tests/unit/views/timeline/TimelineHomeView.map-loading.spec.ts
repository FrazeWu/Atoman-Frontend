import path from 'node:path'
import { readFileSync } from 'node:fs'

const timelineHomeSource = readFileSync(
  path.resolve(process.cwd(), 'src/views/timeline/TimelineHomeView.vue'),
  'utf8',
)

describe('TimelineHomeView map loading', () => {
  it('keeps the map pane behind an async boundary', () => {
    expect(timelineHomeSource).not.toMatch(/from 'ol\//)
    expect(timelineHomeSource).toContain("defineAsyncComponent(() => import('@/views/timeline/TimelineMapPane.vue'))")
    expect(timelineHomeSource).toContain('v-if="viewMode === \'map\'"')
  })
})