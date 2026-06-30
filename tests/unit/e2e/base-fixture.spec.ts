import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('e2e base fixture', () => {
  it('does not globally rewrite page.goto URLs', () => {
    const source = readFileSync(resolve(process.cwd(), 'tests/e2e/fixtures/base.ts'), 'utf8')

    expect(source).not.toContain('page.goto =')
    expect(source).not.toContain('patchGoto(page)')
    expect(source).not.toContain('routeForCurrentModule')
  })
})
