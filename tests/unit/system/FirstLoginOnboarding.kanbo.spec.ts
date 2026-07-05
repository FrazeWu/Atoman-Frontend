import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('FirstLoginOnboarding kanbo terminology', () => {
  it('uses 播客 terminology instead of Studio wording', () => {
    const source = readFileSync('src/components/onboarding/FirstLoginOnboarding.vue', 'utf8')

    expect(source).toContain("title: '播客'")
    expect(source).not.toContain('Studio')
  })
})
