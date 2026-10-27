import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Timeline Modal Contract', () => {
  it('TimelineHomeView does not contain duplicate a-modal-header or a-modal-close inside PModal', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/views/timeline/TimelineHomeView.vue'),
      'utf8',
    )
    expect(source).not.toContain('<div class="a-modal-header">')
    expect(source).not.toContain('class="a-modal-close"')
  })

  it('PersonMapView does not contain duplicate a-modal-header or a-modal-close inside PModal', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/views/timeline/PersonMapView.vue'),
      'utf8',
    )
    expect(source).not.toContain('<div class="a-modal-header">')
    expect(source).not.toContain('class="a-modal-close"')
  })

  it('TimelineEventDetailModal does not contain duplicate a-modal-header or a-modal-close inside PModal', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/timeline/TimelineEventDetailModal.vue'),
      'utf8',
    )
    expect(source).not.toContain('<div class="a-modal-header">')
    expect(source).not.toContain('class="a-modal-close"')
  })
})
