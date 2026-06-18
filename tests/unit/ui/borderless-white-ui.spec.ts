import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../../..')

const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const cssBlock = (css: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm'))
  return match?.[1] ?? ''
}

describe('borderless white UI contract', () => {
  it('keeps the app topbar borderless and uses non-moving nav feedback', () => {
    const source = read('src/components/system/AppTopbar.vue')

    expect(source).not.toMatch(/border-bottom:\s*1px/)
    expect(source).not.toMatch(/border-bottom-color/)
    expect(source).not.toMatch(/transform:\s*translate/)
    expect(source).toContain('box-shadow')
    expect(source).toContain('background: var(--a-color-paper-wash)')
  })

  it('keeps sidebar focus visible without an inset divider line', () => {
    const source = read('src/components/ui/PSidebarItem.vue')

    expect(source).not.toContain('box-shadow: inset 4px 0 0')
    expect(source).not.toMatch(/border-left/)
    expect(source).toContain('background: var(--a-color-paper-wash)')
    expect(source).toContain('box-shadow: var(--a-shadow-paper-sm)')
  })

  it('uses shadows for global card hover without hover movement', () => {
    const css = read('src/style.css')
    const cardHoverBlock = cssBlock(css, '.a-card-hover:hover')

    expect(cardHoverBlock).toContain('box-shadow: var(--a-shadow-paper-sm)')
    expect(cardHoverBlock).not.toMatch(/transform\s*:/)
  })
})
