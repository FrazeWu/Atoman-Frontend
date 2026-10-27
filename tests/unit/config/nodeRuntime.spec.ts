import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('consistent Node runtime', () => {
  it('pins verification and asset publishing to the checked-in Node major', () => {
    expect(readFileSync('.nvmrc', 'utf8').trim()).toBe('24')
    for (const file of ['.github/workflows/ci.yml', '.github/workflows/archive-release-assets.yml']) {
      const workflow = readFileSync(file, 'utf8')
      const bunSteps = workflow.match(/uses: oven-sh\/setup-bun@/g) ?? []
      const nodeSteps = workflow.match(/node-version-file: \.nvmrc/g) ?? []
      expect(nodeSteps.length).toBe(bunSteps.length)
      expect(nodeSteps.length).toBeGreaterThan(0)
    }
  })
})
