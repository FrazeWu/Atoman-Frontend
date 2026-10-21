import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Style tokens modularization contract', () => {
  const root = resolve(__dirname, '../../../')

  it('provides modular reset, variables, and layers CSS files', () => {
    expect(existsSync(resolve(root, 'src/shared/tokens/reset.css'))).toBe(true)
    expect(existsSync(resolve(root, 'src/shared/tokens/variables.css'))).toBe(true)
    expect(existsSync(resolve(root, 'src/shared/tokens/layers.css'))).toBe(true)
  })

  it('clips root horizontal overflow without trapping sticky navigation in a scroll container', () => {
    const css = readFileSync(resolve(root, 'src/style.css'), 'utf-8')
    for (const selector of ['html', 'body']) {
      const rule = css.match(new RegExp(`(?:^|\\n)${selector}\\s*\\{([^}]+)\\}`))?.[1]
      expect(rule).toMatch(/overflow-x:\s*clip\s*;/)
      expect(rule).toMatch(/overscroll-behavior-x:\s*none\s*;/)
      expect(rule).not.toMatch(/overflow(?:-y)?:\s*(?:hidden|auto|scroll)/)
    }
  })

  it('defines standard recommendation and comment sheet tokens in variables.css', () => {
    const vars = readFileSync(resolve(root, 'src/shared/tokens/variables.css'), 'utf-8')
    expect(vars).toContain('--a-recommendation-width')
    expect(vars).toContain('--a-comment-sheet-width')
  })

  it('defines structured z-index layers in layers.css', () => {
    const layers = readFileSync(resolve(root, 'src/shared/tokens/layers.css'), 'utf-8')
    expect(layers).toContain('--a-layer-normal-sheet-backdrop')
    expect(layers).toContain('--a-layer-player')
    expect(layers).toContain('--a-layer-toast')
  })

  it('keeps PostEditorView reset contract intact in style.css for PostEditorView.layout.spec.ts', () => {
    const styleCss = readFileSync(resolve(root, 'src/style.css'), 'utf-8')
    expect(styleCss).toMatch(/\.a-content-frame > \.editor-page[\s\S]*?max-width: none/)
  })
})
