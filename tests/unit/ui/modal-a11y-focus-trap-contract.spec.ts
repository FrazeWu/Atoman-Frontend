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

describe('modal-a11y-focus-trap-contract', () => {
  describe('PModal.vue full modal a11y & focus trap contract', () => {
    const content = getComponentContent('src/components/ui/PModal.vue')

    it('implements semantic role attribute with configurable role support', () => {
      expect(content).toContain(':role="role"')
      expect(content).toContain("role: 'dialog'")
    })

    it('implements aria-modal="true" for assistive tech dialog modality', () => {
      expect(content).toContain('aria-modal="true"')
    })

    it('implements accessible name resolution via aria-labelledby and aria-label', () => {
      expect(content).toContain(':aria-labelledby="title ? titleId : undefined"')
      expect(content).toContain(':aria-label="title ? undefined : dialogLabel"')
    })

    it('integrates useDialogFocus composable for focus trapping and lifecycle', () => {
      expect(content).toContain('useDialogFocus(visible, dialogRef, handleClose')
      expect(content).toContain('import { useDialogFocus } from')
    })

    it('enforces zero box-shadow design system constraint', () => {
      expect(content).toContain('box-shadow: none !important;')
    })
  })

  describe('PConfirm.vue alertdialog contract', () => {
    const content = getComponentContent('src/components/ui/PConfirm.vue')

    it('implements role="alertdialog" on PModal wrapper', () => {
      expect(content).toContain('role="alertdialog"')
    })

    it('links dialog body message via aria-describedby', () => {
      expect(content).toContain(':aria-describedby="confirmMessageId"')
      expect(content).toContain(':id="confirmMessageId"')
    })

    it('passes danger-aware initial focus strategy to PModal', () => {
      expect(content).toContain(':initial-focus="resolveInitialFocus"')
      expect(content).toContain('resolveInitialFocus')
    })

    it('generates unique accessible IDs using Vue 3 useId()', () => {
      expect(content).toContain('useId()')
    })
  })

  describe('useDialogFocus.ts focus trap & visibility contract', () => {
    const content = getComponentContent('src/composables/useDialogFocus.ts')

    it('exports and implements isElementVisible to filter out hidden elements', () => {
      expect(content).toContain('export function isElementVisible(')
      expect(content).toContain('aria-hidden')
      expect(content).toContain('inert')
      expect(content).toContain('disabled')
    })

    it('exports and implements getFocusableElements querying valid targets', () => {
      expect(content).toContain('export function getFocusableElements(')
      expect(content).toContain('FOCUSABLE_SELECTOR')
    })

    it('handles Escape key to close top-layer modal and prevent bubbling', () => {
      expect(content).toContain('"Escape"')
      expect(content).toContain('isCurrentTopLayer()')
    })

    it('handles Tab and Shift+Tab key trapping within boundary elements', () => {
      expect(content).toContain('"Tab"')
      expect(content).toContain('event.shiftKey')
    })

    it('manages scroll lock with activeScrollLockCount counter and hidden overflow', () => {
      expect(content).toContain('activeScrollLockCount')
      expect(content).toContain('overflow = "hidden"')
    })
  })

  describe('PSafeLinkModal.vue wraps PModal for standard focus trap and a11y', () => {
    const content = getComponentContent('src/components/ui/PSafeLinkModal.vue')

    it('wraps PModal component rather than rolling custom overlay/teleport', () => {
      expect(content).toContain('<PModal')
      expect(content).toContain("import PModal from '@/components/ui/PModal.vue'")
    })

    it('delegates visibility and close event handling to PModal', () => {
      expect(content).toContain(':show="safeLinkState.isOpen"')
      expect(content).toContain('@close="closeSafeLink"')
    })

    it('enforces zero box-shadow design system constraint', () => {
      expect(content).toContain('box-shadow: none !important;')
    })
  })
})
