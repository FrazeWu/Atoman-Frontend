import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('approved design-system contract', () => {
  it('defines canonical semantic colors and flat geometry', () => {
    const css = read('src/style.css')

    expect(css).toContain('--a-color-primary: #2563eb;')
    expect(css).toContain('--a-color-primary-hover: #1d4ed8;')
    expect(css).toContain('--a-color-primary-pressed: #1e40af;')
    expect(css).toContain('--a-color-success: #0d9488;')
    expect(css).toContain('--a-color-warning: #ea580c;')
    expect(css).toContain('--a-color-danger: #dc2626;')
    expect(css).toContain('--a-radius-base: 4px;')
    expect(css).toContain('--a-font-weight-strong: 500;')
    expect(css).toContain('--a-shadow-modal: none;')
  })

  it('does not retain module colors as global primary aliases', () => {
    const css = read('src/style.css')

    expect(css).not.toContain('--a-color-accent-confirm: var(--a-color-ink)')
    expect(css).not.toContain('--a-color-accent-destructive: #ea580c')
  })

  it('uses semantic colors for shared buttons', () => {
    const source = read('src/components/ui/PButton.vue')

    expect(source).toContain('background: var(--a-color-primary);')
    expect(source).toContain('background: var(--a-color-primary-hover);')
    expect(source).toContain('background: var(--a-color-primary-pressed);')
    expect(source).toContain('outline: 2px solid var(--a-color-primary);')
    expect(source).toContain('color: var(--a-color-danger);')
    expect(source).not.toContain('letter-spacing: 0.05em;')
  })
})
