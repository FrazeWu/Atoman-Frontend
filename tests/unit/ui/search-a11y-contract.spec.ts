import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function getComponentContent(relativePath: string): string {
  const primaryPath = resolve(process.cwd(), relativePath)
  const fullPath = existsSync(primaryPath)
    ? primaryPath
    : resolve(__dirname, '../../..', relativePath)

  expect(existsSync(fullPath)).toBe(true)
  return readFileSync(fullPath, 'utf-8')
}

describe('search-a11y-contract', () => {
  describe('AppTopbarGlobalSearch.vue combobox & listbox contract', () => {
    const content = getComponentContent('src/components/system/AppTopbarGlobalSearch.vue')

    it('implements combobox attributes on search input', () => {
      expect(content).toContain('role="combobox"')
      expect(content).toContain('aria-autocomplete="list"')
      expect(content).toContain('aria-haspopup="listbox"')
      expect(content).toContain('aria-controls="topbar-search-results-listbox"')
      expect(content).toContain(':aria-activedescendant=')
    })

    it('implements listbox container with correct id and role', () => {
      expect(content).toContain('id="topbar-search-results-listbox"')
      expect(content).toContain('role="listbox"')
    })

    it('enforces zero box-shadow design system constraint', () => {
      expect(content).toContain('box-shadow: none !important;')
    })
  })

  describe('TopbarSearchSection.vue group & option contract', () => {
    const content = getComponentContent('src/components/system/TopbarSearchSection.vue')

    it('implements role="group" on search section', () => {
      expect(content).toContain('role="group"')
    })

    it('implements option role and selection binding on search items', () => {
      expect(content).toContain('role="option"')
      expect(content).toContain(':aria-selected=')
      expect(content).toContain(':id="`search-option-${item.id}`"')
    })
  })

  describe('PUnifiedSearchBar.vue combobox & listbox contract', () => {
    const content = getComponentContent('src/components/search/PUnifiedSearchBar.vue')

    it('implements combobox role and aria-controls linking to preview listbox', () => {
      expect(content).toContain('role="combobox"')
      expect(content).toContain('aria-controls="unified-search-preview-listbox"')
    })

    it('implements preview dropdown listbox container', () => {
      expect(content).toContain('id="unified-search-preview-listbox"')
      expect(content).toContain('role="listbox"')
    })

    it('implements option items and selection states', () => {
      expect(content).toContain('role="option"')
      expect(content).toContain(':aria-selected=')
    })

    it('enforces zero box-shadow design system constraint', () => {
      expect(content).toContain('box-shadow: none !important;')
    })
  })

  describe('PSearchInput.vue combobox ARIA passthrough', () => {
    const content = getComponentContent('src/components/ui/PSearchInput.vue')

    it('supports combobox ARIA passthrough props on native input element', () => {
      expect(content).toContain(':aria-controls="ariaControls"')
      expect(content).toContain(':aria-activedescendant="ariaActiveDescendant"')
    })
  })
})
