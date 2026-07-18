import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadTextFile, sanitizeDownloadName } from '@/utils/textDownload'

describe('textDownload', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sanitizes reserved filename characters and falls back for an empty name', () => {
    expect(sanitizeDownloadName('  A/B:*? "demo"  ')).toBe('A-B- -demo-')
    expect(sanitizeDownloadName('   ')).toBe('lyrics')
  })

  it('downloads UTF-8 text with a sanitized filename and revokes the object URL', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:lyrics')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const createElement = vi.spyOn(document, 'createElement')

    downloadTextFile('A/B', '歌词', '.lrc')

    const blob = create.mock.calls[0]?.[0] as Blob
    const anchor = createElement.mock.results
      .map(result => result.value)
      .find((element): element is HTMLAnchorElement => element instanceof HTMLAnchorElement)

    expect(blob.type).toBe('text/plain;charset=utf-8')
    expect(await blob.text()).toBe('歌词')
    expect(anchor.download).toBe('A-B.lrc')
    expect(anchor.href).toBe('blob:lyrics')
    expect(click).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:lyrics')
    expect(click.mock.invocationCallOrder[0]).toBeLessThan(revoke.mock.invocationCallOrder[0]!)
  })
})
