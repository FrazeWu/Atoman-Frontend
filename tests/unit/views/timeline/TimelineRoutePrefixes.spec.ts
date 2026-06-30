import { readFileSync } from 'node:fs'
import path from 'node:path'

const readTimelineView = (fileName: string) =>
  readFileSync(path.resolve(process.cwd(), 'src/views/timeline', fileName), 'utf8')

describe('timeline route prefixes', () => {
  it('keeps layout navigation inside the timeline module', () => {
    const source = readTimelineView('TimelineLayout.vue')

    expect(source).toContain('to="/timeline"')
    expect(source).toContain('to="/timeline/persons"')
    expect(source).not.toContain('to="/"')
    expect(source).not.toContain('to="/persons"')
  })

  it('opens person map pages under the timeline module', () => {
    const listSource = readTimelineView('PersonListView.vue')
    const homeSource = readTimelineView('TimelineHomeView.vue')

    expect(listSource).toContain('router.push(`/timeline/person/${person.id}`)')
    expect(listSource).toContain('router.push(`/timeline/person/${created.id}`)')
    expect(homeSource).toContain('router.push(`/timeline/person/${created.id}`)')
  })

  it('returns from person map pages to the timeline person list', () => {
    const source = readTimelineView('PersonMapView.vue')

    expect(source).toContain('to="/timeline/persons"')
    expect(source).toContain("router.push('/timeline/persons')")
    expect(source).not.toContain('to="/persons"')
    expect(source).not.toContain("router.push('/persons')")
  })
})
