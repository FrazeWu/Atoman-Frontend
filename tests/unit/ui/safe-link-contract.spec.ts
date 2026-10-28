import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

describe('safe-link-contract', () => {
  it('ensures PSafeLinkModal is mounted in App.vue and MobileApp.vue', () => {
    const desktopAppPath = resolve(process.cwd(), 'src/App.vue')
    const mobileAppPath = resolve(process.cwd(), 'apps/mobile/MobileApp.vue')

    expect(existsSync(desktopAppPath)).toBe(true)
    expect(existsSync(mobileAppPath)).toBe(true)

    const desktopContent = readFileSync(desktopAppPath, 'utf-8')
    const mobileContent = readFileSync(mobileAppPath, 'utf-8')

    expect(desktopContent).toContain('PSafeLinkModal')
    expect(mobileContent).toContain('PSafeLinkModal')
  })

  it('ensures PSafeLinkModal has box-shadow none constraint', () => {
    const modalPath = resolve(process.cwd(), 'src/components/ui/PSafeLinkModal.vue')
    expect(existsSync(modalPath)).toBe(true)
    const content = readFileSync(modalPath, 'utf-8')
    expect(content).toContain('box-shadow: none !important;')
  })
})
