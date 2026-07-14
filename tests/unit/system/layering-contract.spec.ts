import path from 'node:path'
import { readFileSync } from 'node:fs'

const specPath = path.resolve(process.cwd(), 'docs/specs/2026-05-29-frontend-component-refactor-design.md')

describe('frontend layering contract docs', () => {
  it('documents the three-layer model in the active component refactor spec', () => {
    const spec = readFileSync(specPath, 'utf8')

    expect(spec).toContain('views')
    expect(spec).toContain('components')
    expect(spec).toContain('UI Primitive Layer')
    expect(spec).toContain('Route Layer')
  })
})
