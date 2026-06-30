import { readFileSync } from 'node:fs'
import path from 'node:path'

const wranglerSource = readFileSync(path.resolve(process.cwd(), 'wrangler.toml'), 'utf8')

function getTomlSection(source: string, sectionName: string) {
  const sectionStart = source.indexOf(`[${sectionName}]`)
  if (sectionStart === -1) {
    return ''
  }

  const nextSectionStart = source.indexOf('\n[', sectionStart + 1)
  return source.slice(sectionStart, nextSectionStart === -1 ? undefined : nextSectionStart)
}

describe('Cloudflare Pages vars', () => {
  it('declares the Turnstile site key for default and production builds', () => {
    for (const sectionName of ['vars', 'env.production.vars']) {
      expect(getTomlSection(wranglerSource, sectionName)).toMatch(
        /^VITE_TURNSTILE_SITE_KEY\s*=/m,
      )
    }
  })
})
