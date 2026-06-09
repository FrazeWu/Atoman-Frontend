import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('FirstLoginOnboarding kanbo terminology', () => {
  it('uses 刊播 instead of Studio wording', () => {
    const source = readFileSync('src/components/onboarding/FirstLoginOnboarding.vue', 'utf8')

    expect(source).toContain("title: '刊播'")
    expect(source).not.toContain('Studio')
  })
})
