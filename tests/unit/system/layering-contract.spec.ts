import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

const specPath = path.resolve(process.cwd(), 'docs/specs/2026-05-29-frontend-component-refactor-design.md')
const guidePath = path.resolve(process.cwd(), 'UI_COMPONENTS.md')

describe('frontend layering contract docs', () => {
  it('documents the three-layer model in the active component refactor spec', () => {
    const spec = readFileSync(specPath, 'utf8')

    expect(spec).toContain('views')
    expect(spec).toContain('components')
    expect(spec).toContain('UI Primitive Layer')
    expect(spec).toContain('Route Layer')
  })

  it.skipIf(!existsSync(guidePath))('documents the layer model in the UI guide when present', () => {
    const guide = readFileSync(guidePath, 'utf8')

    expect(guide).toContain('## Layer Model')
    expect(guide).toContain('Primitives -> Building Blocks -> Views')
  })
})
