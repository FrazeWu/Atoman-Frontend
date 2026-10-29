import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function getFileContent(relativePath: string): string {
  const primaryPath = resolve(process.cwd(), relativePath)
  const fullPath = existsSync(primaryPath)
    ? primaryPath
    : resolve(__dirname, '../../..', relativePath)

  expect(existsSync(fullPath)).toBe(true)
  return readFileSync(fullPath, 'utf-8')
}

describe('form-a11y-contract', () => {
  describe('PInput.vue form accessibility & zero-shadow contract', () => {
    const content = getFileContent('src/components/ui/PInput.vue')

    it('imports and uses Vue 3 useId for accessible element relationships', () => {
      expect(content).toMatch(/import\s*\{[^}]*useId[^}]*\}\s*from\s*['"]vue['"]/)
      expect(content).toMatch(/useId\(\)/)
    })

    it('binds :aria-invalid for assistive technology error state detection', () => {
      expect(content).toContain(':aria-invalid=')
    })

    it('binds :aria-describedby for field description or error linkage', () => {
      expect(content).toContain(':aria-describedby=')
    })

    it('binds :aria-errormessage pointing to validation error identifier', () => {
      expect(content).toContain(':aria-errormessage=')
    })

    it('implements role="alert" and aria-live="polite" on error container', () => {
      expect(content).toContain('role="alert"')
      expect(content).toContain('aria-live="polite"')
      expect(content).toMatch(/role="alert"[\s\S]*?aria-live="polite"|aria-live="polite"[\s\S]*?role="alert"/)
    })

    it('enforces zero box-shadow design system constraint', () => {
      expect(content).toContain('box-shadow: none !important;')
    })
  })

  describe('PTextarea.vue form accessibility & zero-shadow contract', () => {
    const content = getFileContent('src/components/ui/PTextarea.vue')

    it('imports and uses Vue 3 useId for accessible element relationships', () => {
      expect(content).toMatch(/import\s*\{[^}]*useId[^}]*\}\s*from\s*['"]vue['"]/)
      expect(content).toMatch(/useId\(\)/)
    })

    it('binds :aria-invalid for assistive technology error state detection', () => {
      expect(content).toContain(':aria-invalid=')
    })

    it('binds :aria-describedby for field description or error linkage', () => {
      expect(content).toContain(':aria-describedby=')
    })

    it('binds :aria-errormessage pointing to validation error identifier', () => {
      expect(content).toContain(':aria-errormessage=')
    })

    it('implements role="alert" and aria-live="polite" on error container', () => {
      expect(content).toContain('role="alert"')
      expect(content).toContain('aria-live="polite"')
      expect(content).toMatch(/role="alert"[\s\S]*?aria-live="polite"|aria-live="polite"[\s\S]*?role="alert"/)
    })

    it('enforces zero box-shadow design system constraint', () => {
      expect(content).toContain('box-shadow: none !important;')
    })
  })

  describe('PSelect.vue form accessibility & zero-shadow contract', () => {
    const content = getFileContent('src/components/ui/PSelect.vue')

    it('imports and uses Vue 3 useId for accessible element relationships', () => {
      expect(content).toMatch(/import\s*\{[^}]*useId[^}]*\}\s*from\s*['"]vue['"]/)
      expect(content).toMatch(/useId\(\)/)
    })

    it('binds :aria-invalid for assistive technology error state detection', () => {
      expect(content).toContain(':aria-invalid=')
    })

    it('binds :aria-describedby for field description or error linkage', () => {
      expect(content).toContain(':aria-describedby=')
    })

    it('binds :aria-errormessage pointing to validation error identifier', () => {
      expect(content).toContain(':aria-errormessage=')
    })

    it('implements role="alert" and aria-live="polite" on error container', () => {
      expect(content).toContain('role="alert"')
      expect(content).toContain('aria-live="polite"')
      expect(content).toMatch(/role="alert"[\s\S]*?aria-live="polite"|aria-live="polite"[\s\S]*?role="alert"/)
    })

    it('enforces zero box-shadow design system constraint', () => {
      expect(content).toContain('box-shadow: none !important;')
    })
  })

  describe('PField.vue form accessibility contract', () => {
    const content = getFileContent('src/components/ui/PField.vue')

    it('implements role="alert" and aria-live="polite" on error container', () => {
      expect(content).toContain('role="alert"')
      expect(content).toContain('aria-live="polite"')
      expect(content).toMatch(/role="alert"[\s\S]*?aria-live="polite"|aria-live="polite"[\s\S]*?role="alert"/)
    })
  })

  describe('useFormFocusError.ts focus navigation contract', () => {
    const content = getFileContent('src/composables/useFormFocusError.ts')

    it('queries invalid form controls via [aria-invalid="true"]', () => {
      expect(content).toContain('[aria-invalid="true"')
    })

    it('calls scrollIntoView to reveal invalid element to user', () => {
      expect(content).toContain('scrollIntoView(')
    })

    it('calls focus to guide user input to invalid element', () => {
      expect(content).toContain('.focus(')
    })
  })
})
