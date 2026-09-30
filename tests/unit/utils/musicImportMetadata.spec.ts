import { describe, expect, it } from 'vitest'
import { localizedMusicCountry } from '../../../src/utils/musicImportMetadata'

describe('localizedMusicCountry', () => {
  it('converts ISO region codes to Chinese labels', () => {
    expect(localizedMusicCountry('TW')).toBe('台湾')
    expect(localizedMusicCountry('US')).toMatch(/美国/)
  })

  it('preserves already localized values', () => {
    expect(localizedMusicCountry('台湾')).toBe('台湾')
  })
})
