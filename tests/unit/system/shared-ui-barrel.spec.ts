import { describe, expect, it } from 'vitest'
import * as SharedUI from '@/shared/ui'

describe('Shared UI Barrel Exports', () => {
  it('exports standard design system components', () => {
    expect(SharedUI.PButton).toBeDefined()
    expect(SharedUI.PSheet).toBeDefined()
    expect(SharedUI.PModal).toBeDefined()
    expect(SharedUI.PPageHeader).toBeDefined()
    expect(SharedUI.PToast).toBeDefined()
    expect(SharedUI.PCard).toBeDefined()
  })
})
