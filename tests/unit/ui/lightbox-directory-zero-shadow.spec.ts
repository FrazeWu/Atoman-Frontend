import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Lightbox, Directory, and Theme Zero-Shadow Contract', () => {
  const directoryPath = path.resolve(__dirname, '../../../src/components/ui/PDirectoryNav.vue')
  const lightboxPath = path.resolve(__dirname, '../../../src/components/ui/PImageLightbox.vue')
  const themePresetPath = path.resolve(__dirname, '../../../src/components/theme/ThemePresetControl.vue')
  const themeCssEditorPath = path.resolve(__dirname, '../../../src/components/theme/ThemeCssEditor.vue')

  it('eliminates box-shadow from PDirectoryNav mobile/right sheet', () => {
    const content = fs.readFileSync(directoryPath, 'utf-8')
    expect(content).not.toMatch(/box-shadow:\s*-?12px/)
  })

  it('eliminates box-shadow and enforces 4px radius on PImageLightbox', () => {
    const content = fs.readFileSync(lightboxPath, 'utf-8')
    expect(content).not.toMatch(/\.p-lightbox-image\s*\{[^}]*box-shadow:\s+(?!none\b)/)
    expect(content).toMatch(/border-radius:\s*var\(--a-radius-card,\s*4px\);/)
  })

  it('eliminates box-shadow and tokenizes color on ThemePresetControl color-check-dot', () => {
    const content = fs.readFileSync(themePresetPath, 'utf-8')
    expect(content).not.toMatch(/\.color-check-dot\s*\{[^}]*box-shadow:\s+(?!none\b)/)
    expect(content).toMatch(/\.color-check-dot\s*\{[^}]*background-color:\s*var\(--a-color-primary-contrast\);/)
  })

  it('eliminates glow box-shadow on ThemeCssEditor focus state', () => {
    const content = fs.readFileSync(themeCssEditorPath, 'utf-8')
    expect(content).not.toMatch(/\.editor-textarea:focus\s*\{[^}]*box-shadow:\s*0\s+0\s+0\s+2px\s+rgba/)
    expect(content).toMatch(/\.editor-textarea:focus\s*\{[^}]*outline:\s*2px solid var\(--a-color-primary\);/)
  })
})
