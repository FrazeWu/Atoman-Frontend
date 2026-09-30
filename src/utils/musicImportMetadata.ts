const COUNTRY_ALIASES: Record<string, string> = {
  TW: '台湾',
  TAIWAN: '台湾',
  臺灣: '台湾',
  HK: '中国香港',
  HONGKONG: '中国香港',
}

const regionNamesInChinese = typeof Intl !== 'undefined' && typeof Intl.DisplayNames !== 'undefined'
  ? new Intl.DisplayNames(['zh-CN'], { type: 'region' })
  : null

export function localizedMusicCountry(value?: string) {
  const raw = value?.trim() ?? ''
  if (!raw) return ''
  const alias = COUNTRY_ALIASES[raw.toUpperCase().replace(/[\s_-]+/g, '')]
  if (alias) return alias
  if (/^[A-Za-z]{2}$/.test(raw)) {
    try {
      return regionNamesInChinese?.of(raw.toUpperCase())?.trim() || raw
    } catch {
      return raw
    }
  }
  return raw
}
