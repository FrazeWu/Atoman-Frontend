import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const sourceText = (directory: string): string => readdirSync(resolve(root, directory))
  .flatMap((name) => {
    const relativePath = `${directory}/${name}`
    const absolutePath = resolve(root, relativePath)
    return statSync(absolutePath).isDirectory()
      ? [sourceText(relativePath)]
      : /\.(?:css|vue)$/.test(name) ? [read(relativePath)] : []
  })
  .join('\n')

describe('modern flat UI design-system contract', () => {
  it('uses neutral semantic tokens and soft geometry', () => {
    const css = read('src/style.css')

    expect(css).toContain('--a-color-surface-muted: #f1f5f9;')
    expect(css).toContain('--a-color-text: #0f172a;')
    expect(css).toContain('--a-color-text-secondary: #334155;')
    expect(css).toContain('--a-color-border-soft: #e2e8f0;')
    expect(css).toContain('--a-font-sans:')
    expect(css).toContain('--a-font-mono:')
    expect(css).toContain('--a-radius-control: 8px;')
    expect(css).toMatch(/--a-shadow-sm:\s*0\s+\d+px\s+\d+px/)
  })

  it('does not expose the retired paper and ink token vocabulary', () => {
    const css = read('src/style.css')

    expect(css).not.toMatch(/--a-color-(?:paper|ink|tape)/)
    expect(css).not.toMatch(/--a-font-(?:serif|meta)/)
    expect(css).not.toMatch(/--a-shadow-paper/)
  })

  it('keeps shared cards quiet until interaction', () => {
    const source = read('src/components/ui/PCard.vue')

    expect(source).toContain('background: var(--a-color-bg);')
    expect(source).toContain('border-radius: var(--a-radius-card);')
    expect(source).toContain('box-shadow: var(--a-shadow-sm);')
    expect(source).not.toMatch(/dashed|border-left|text-decoration:\s*underline/)
  })

  it('uses compact shared headings', () => {
    const pageHeader = read('src/components/ui/PPageHeader.vue')
    const sectionHeader = read('src/components/ui/PSectionHeader.vue')

    expect(pageHeader).toContain('font-size: 2rem;')
    expect(sectionHeader).toContain('font-size: 1.5rem;')
    expect(pageHeader).not.toMatch(/font-size:\s*3(?:\.\d+)?rem/)
    expect(sectionHeader).not.toMatch(/font-size:\s*2\.75rem/)
  })

  it('removes retired paper assets and visual metaphors from source styles', () => {
    const source = sourceText('src')

    expect(existsSync(resolve(root, 'src/assets/paper-ink.css'))).toBe(false)
    expect(source).not.toMatch(/paper-[\w-]+/)
    expect(source).not.toMatch(/\bdashed\b/)
    expect(source).not.toContain('var(--a-font-mono)')
    expect(source).not.toMatch(/repeating-linear-gradient/)
    expect(source).not.toMatch(/box-shadow:\s*-?\d+px\s+-?\d+px\s+0(?:px)?/)
  })

  it('uses neutral shared field naming and standard form styling', () => {
    const choice = read('src/components/ui/PChoiceField.vue')
    const country = read('src/components/ui/PCountryRegionField.vue')
    const select = read('src/components/ui/PSelect.vue')
    const textarea = read('src/components/ui/PTextarea.vue')

    expect(choice).not.toMatch(/paper-|a-font-mono|choice-dot/)
    expect(country).not.toMatch(/paper-|a-font-mono|field-dot/)
    expect(select).not.toMatch(/a-font-mono|p-field-dot/)
    expect(textarea).not.toMatch(/a-font-mono|p-field-dot|Ruled lines|background-image/)
    expect(textarea).toContain('border: 1px solid var(--a-color-border-soft);')
  })
})
