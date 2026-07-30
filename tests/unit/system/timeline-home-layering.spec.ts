import path from 'node:path'
import { readFileSync } from 'node:fs'

describe('TimelineHomeView layering', () => {
  it('delegates event editing, revision history, and person creation to composables', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'src/views/timeline/TimelineHomeView.vue'),
      'utf8',
    )

    for (const composable of [
      'useTimelineEventEditor({',
      'useTimelineHistory()',
      'useTimelinePersonCreation()',
    ]) {
      expect(source).toContain(composable)
    }

    for (const implementationDetail of [
      'const emptyForm = () =>',
      '/timeline/events/${targetEventId}/history',
      'store.createPerson(',
    ]) {
      expect(source).not.toContain(implementationDetail)
    }
  })
})
