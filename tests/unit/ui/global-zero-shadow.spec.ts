import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Global Zero-Shadow and Modal/Dropdown Border Contract', () => {
  const styleCssPath = path.resolve(__dirname, '../../../src/style.css')
  const authControlsPath = path.resolve(__dirname, '../../../src/components/system/AppTopbarAuthControls.vue')

  it('defines all --a-shadow-* tokens as none in src/style.css', () => {
    const content = fs.readFileSync(styleCssPath, 'utf-8')

    // Root light mode
    expect(content).toMatch(/--a-shadow-sm:\s*none;/)
    expect(content).toMatch(/--a-shadow-md:\s*none;/)
    expect(content).toMatch(/--a-shadow-lg:\s*none;/)
    expect(content).toMatch(/--a-shadow-hover:\s*none;/)
    expect(content).toMatch(/--a-shadow-active:\s*none;/)

    // Dark mode block
    expect(content).not.toMatch(/--a-shadow-dropdown:\s*\n?\s*0\s+12px/)
    expect(content).not.toMatch(/--a-shadow-modal:\s*\n?\s*0\s+24px/)
  })

  it('enforces 1px border on .p-modal and .a-modal in src/style.css', () => {
    const content = fs.readFileSync(styleCssPath, 'utf-8')
    expect(content).toMatch(/\.p-modal[\s\S]*?border:\s*1px solid var\(--a-color-border\);/)
  })

  it('enforces 1px border and 4px radius on .dropdown in AppTopbarAuthControls.vue', () => {
    const content = fs.readFileSync(authControlsPath, 'utf-8')
    expect(content).toMatch(/\.dropdown\s*\{[\s\S]*?border:\s*1px solid var\(--a-color-border\);/)
    expect(content).toMatch(/\.dropdown\s*\{[\s\S]*?border-radius:\s*var\(--a-radius-card,\s*4px\);/)
  })
})
