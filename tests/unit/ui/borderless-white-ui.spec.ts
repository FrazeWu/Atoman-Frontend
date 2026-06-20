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

  it('enforces borderless sidebar containers, active indicator removal, and borderless dividers', () => {
    const css = read('src/style.css')
    const sidebarBlock = cssBlock(css, '.a-sidebar,\n.p-sidebar')
    expect(sidebarBlock).toContain('background-color: var(--a-color-bg)')
    expect(sidebarBlock).not.toMatch(/border-right\s*:/)

    const activeIndicatorBlock = cssBlock(css, '.a-sidebar-item.active::before,\n.p-sidebar-item.active::before')
    expect(activeIndicatorBlock).toContain('display: none')

    const dividerBlock = cssBlock(css, '.a-sidebar-divider,\n.p-sidebar-divider')
    expect(dividerBlock).not.toMatch(/border-bottom\s*:/)
  })

  it('enforces flat white UI card and surface styling rules', () => {
    const pCardSource = read('src/components/ui/PCard.vue')
    const pSurfaceSource = read('src/components/ui/PSurface.vue')
    const pVideoCardSource = read('src/components/shared/PVideoCard.vue')

    // PCard contract
    expect(pCardSource).toContain('border: none;')
    expect(pCardSource).toContain('border-bottom: 1.5px dashed var(--a-color-line-soft);')
    expect(pCardSource).toContain('border-left: 3px solid transparent;')
    expect(pCardSource).toContain('border-radius: 8px;')
    expect(pCardSource).toContain('border-left-color: var(--a-color-ink);')
    expect(pCardSource).toContain('text-decoration: underline !important;')

    // PSurface contract
    expect(pSurfaceSource).toContain('border-radius: 8px;')

    // PVideoCard contract
    expect(pVideoCardSource).toContain('border-radius: 8px;') // for vc-thumb
    expect(pVideoCardSource).toContain('border-radius: 0px;') // for vc-play-count and vc-duration
  })
})
