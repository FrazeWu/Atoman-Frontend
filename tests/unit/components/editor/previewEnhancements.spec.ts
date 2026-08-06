import { beforeEach, describe, expect, it, vi } from 'vitest'

import { enhancePreviewCodeBlocks } from '@/components/shared/editor/previewEnhancements'

describe('enhancePreviewCodeBlocks', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('adds one language toolbar and copies the code text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    document.body.innerHTML = '<div id="preview"><pre><code class="language-ts">const answer = 42</code></pre></div>'
    const root = document.querySelector<HTMLElement>('#preview')

    enhancePreviewCodeBlocks(root)
    enhancePreviewCodeBlocks(root)

    expect(root?.querySelectorAll('.code-block-titlebar')).toHaveLength(1)
    expect(root?.querySelector('.code-block-lang')?.textContent).toBe('ts')
    const button = root?.querySelector<HTMLButtonElement>('.code-block-copy')
    button?.click()
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledWith('const answer = 42')
    expect(button?.textContent).toBe('已复制')
  })
})
