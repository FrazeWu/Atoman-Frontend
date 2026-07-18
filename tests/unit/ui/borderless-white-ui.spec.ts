import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('borderless white UI contract', () => {
  it('uses rounded, non-moving topbar navigation feedback', () => {
    const source = read('src/components/system/AppTopbar.vue')

    expect(source).toContain('border-radius: var(--a-radius-control);')
    expect(source).toContain('background: var(--a-color-surface-muted);')
    expect(source).not.toMatch(/\.nav-link[^}]*transform:\s*translate/s)
    expect(source).not.toContain('.topbar::after')
  })

  it('uses icon-and-label sidebar items without archive numbering', () => {
    const item = read('src/components/ui/PSidebarItem.vue')
    const sidebar = read('src/components/ui/PSidebar.vue')
    const globalStyle = read('src/style.css')

    expect(item).not.toContain('formattedIndex')
    expect(item).not.toContain('p-sidebar-item-num')
    expect(item).toContain('border-radius: var(--a-radius-control);')
    expect(item).toContain('background: var(--a-color-surface-muted);')
    expect(sidebar).toContain('grid-template-columns: auto minmax(0, 1fr);')
    expect(globalStyle).not.toContain('border-left-color: var(--a-color-text);')
    expect(globalStyle).not.toContain('.p-sidebar-item-num')
  })

  it('keeps the footer free of archive tick decorations', () => {
    const source = read('src/components/system/SiteFooter.vue')

    expect(source).not.toContain('.site-footer::before')
    expect(source).not.toContain('.site-footer::after')
  })

  it('uses borderless shared surfaces without paper tone naming', () => {
    const source = read('src/components/ui/PSurface.vue')

    expect(source).toContain("tone?: 'default' | 'soft'")
    expect(source).toContain("tone: 'default'")
    expect(source).toContain('border: none;')
    expect(source).toContain('border-radius: var(--a-radius-card);')
    expect(source).not.toMatch(/paper|dashed/)
  })

  it('renders empty states as content rather than dashed document boxes', () => {
    const source = read('src/style.css')
    const empty = read('src/components/ui/PEmpty.vue')

    expect(source).not.toMatch(/\.a-empty\s*\{[^}]*dashed/s)
    expect(empty).not.toMatch(/border-(?:top|bottom):/)
  })
})
