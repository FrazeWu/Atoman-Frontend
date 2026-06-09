import path from 'node:path'
import { readFileSync } from 'node:fs'

describe('frontend layering contract docs', () => {
  it('documents the three-layer model in the active component refactor spec and UI guide', () => {
    const spec = readFileSync(
      path.resolve(process.cwd(), '../docs/superpowers/specs/2026-05-29-frontend-component-refactor-design.md'),
      'utf8',
    )
    const guide = readFileSync(path.resolve(process.cwd(), 'UI_COMPONENTS.md'), 'utf8')

    expect(spec).toContain('views')
    expect(spec).toContain('components')
    expect(guide).toContain('## Layer Model')
    expect(guide).toContain('Primitives -> Building Blocks -> Views')
  })
})
