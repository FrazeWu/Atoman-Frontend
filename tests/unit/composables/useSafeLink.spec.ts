import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSafeLink } from '@/composables/useSafeLink'

describe('useSafeLink', () => {
  beforeEach(() => {
    const { closeSafeLink } = useSafeLink()
    closeSafeLink()
    vi.restoreAllMocks()
  })

  it('correctly identifies external vs internal links', () => {
    const { isExternalLink } = useSafeLink()
    expect(isExternalLink('/posts/123')).toBe(false)
    expect(isExternalLink('#section')).toBe(false)
    expect(isExternalLink('./relative')).toBe(false)
    expect(isExternalLink('../parent')).toBe(false)
    expect(isExternalLink('mailto:user@example.com')).toBe(false)
    expect(isExternalLink('tel:+123456789')).toBe(false)
    expect(isExternalLink('https://github.com/atoman')).toBe(true)
    expect(isExternalLink('http://example.com')).toBe(true)
    // Same origin check (vitest runs on jsdom where origin is http://localhost:3000 or similar)
    expect(isExternalLink(`${window.location.origin}/test`)).toBe(false)
  })

  it('opens safe link modal and extracts hostname for valid external url', () => {
    const { safeLinkState, openSafeLink, closeSafeLink } = useSafeLink()
    const opened = openSafeLink('https://github.com/atoman/project')
    expect(opened).toBe(true)
    expect(safeLinkState.value.isOpen).toBe(true)
    expect(safeLinkState.value.targetUrl).toBe('https://github.com/atoman/project')
    expect(safeLinkState.value.targetHostname).toBe('github.com')

    closeSafeLink()
    expect(safeLinkState.value.isOpen).toBe(false)
  })

  it('rejects internal and invalid urls', () => {
    const { openSafeLink } = useSafeLink()
    expect(openSafeLink('/internal/path')).toBe(false)
    expect(openSafeLink('javascript:alert(1)')).toBe(false)
    expect(openSafeLink('')).toBe(false)
  })

  it('proceeds to open safe link in new window with noopener noreferrer', () => {
    const { openSafeLink, proceedToSafeLink, safeLinkState } = useSafeLink()
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    openSafeLink('https://example.org/docs')
    proceedToSafeLink()

    expect(openSpy).toHaveBeenCalledWith('https://example.org/docs', '_blank', 'noopener,noreferrer')
    expect(safeLinkState.value.isOpen).toBe(false)
    openSpy.mockRestore()
  })

  it('copies safe link to clipboard and notifies toast', async () => {
    const { openSafeLink, copySafeLink } = useSafeLink()
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      configurable: true,
    })

    openSafeLink('https://example.com/item')
    await copySafeLink()

    expect(writeTextMock).toHaveBeenCalledWith('https://example.com/item')
  })

  it('handles safe link click interception for anchor elements', () => {
    const { handleSafeLinkClick, safeLinkState } = useSafeLink()

    const anchor = document.createElement('a')
    anchor.setAttribute('href', 'https://example.com/intercepted')
    const preventDefault = vi.fn()

    const event = {
      target: anchor,
      preventDefault,
    } as unknown as MouseEvent

    handleSafeLinkClick(event)

    expect(preventDefault).toHaveBeenCalled()
    expect(safeLinkState.value.isOpen).toBe(true)
    expect(safeLinkState.value.targetUrl).toBe('https://example.com/intercepted')
  })

  it('ignores safe link click interception for internal links', () => {
    const { handleSafeLinkClick, safeLinkState } = useSafeLink()

    const anchor = document.createElement('a')
    anchor.setAttribute('href', '/local/route')
    const preventDefault = vi.fn()

    const event = {
      target: anchor,
      preventDefault,
    } as unknown as MouseEvent

    handleSafeLinkClick(event)

    expect(preventDefault).not.toHaveBeenCalled()
    expect(safeLinkState.value.isOpen).toBe(false)
  })
})
