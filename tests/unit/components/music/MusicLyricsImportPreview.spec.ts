import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import MusicLyricsImportPreview from '@/components/music/MusicLyricsImportPreview.vue'
import PModal from '@/components/ui/PModal.vue'
import type { MusicLyricDraftIssue, MusicLyricDraftRow } from '@/utils/musicLyricsDraft'

const rows: MusicLyricDraftRow[] = [
  { id: 'line-1', timeMs: 1_230, original: 'Hello', translation: '你好' },
  { id: 'line-2', timeMs: null, original: 'World', translation: '' },
]

const mounted: VueWrapper[] = []

function mountPreview(options: {
  rows?: MusicLyricDraftRow[]
  issues?: MusicLyricDraftIssue[]
  originalFileName?: string
  translationFileName?: string
} = {}) {
  const wrapper = mount(MusicLyricsImportPreview, {
    props: {
      show: true,
      originalFileName: options.originalFileName ?? 'original.lrc',
      translationFileName: options.translationFileName,
      rows: options.rows ?? rows,
      issues: options.issues ?? [],
    },
  })
  mounted.push(wrapper)
  return wrapper
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

describe('MusicLyricsImportPreview.vue', () => {
  it('renders bilingual rows and confirms a valid import', async () => {
    const wrapper = mountPreview()

    expect(document.body.textContent).toContain('00:01.23')
    expect(document.body.textContent).toContain('Hello')
    expect(document.body.textContent).toContain('你好')
    expect(document.body.textContent).toContain('World')
    expect(document.body.textContent).toContain('--:--.--')

    const confirm = document.body.querySelector<HTMLButtonElement>('[data-testid="lyrics-import-confirm"]')
    expect(confirm?.disabled).toBe(false)
    confirm?.click()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('shows error issues and disables replacement', () => {
    mountPreview({
      issues: [{ severity: 'error', code: 'invalid-time', message: '第 2 行时间格式无效' }],
    })

    expect(document.body.textContent).toContain('第 2 行时间格式无效')
    expect(document.body.querySelector('[data-severity="error"]')).not.toBeNull()
    expect(document.body.querySelector<HTMLButtonElement>('[data-testid="lyrics-import-confirm"]')?.disabled).toBe(true)
  })

  it('shows warning issues without blocking replacement', () => {
    mountPreview({
      issues: [{ severity: 'warning', code: 'duplicate-time', message: '存在重复时间' }],
    })

    expect(document.body.textContent).toContain('存在重复时间')
    expect(document.body.querySelector('[data-severity="warning"]')).not.toBeNull()
    expect(document.body.querySelector<HTMLButtonElement>('[data-testid="lyrics-import-confirm"]')?.disabled).toBe(false)
  })

  it('disables replacement when there are no rows', () => {
    mountPreview({ rows: [] })

    expect(document.body.querySelector<HTMLButtonElement>('[data-testid="lyrics-import-confirm"]')?.disabled).toBe(true)
  })

  it('emits cancel from both the footer button and modal close', async () => {
    const wrapper = mountPreview()

    const cancel = Array.from(document.body.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === '取消')
    cancel?.click()
    expect(wrapper.emitted('cancel')).toHaveLength(1)

    await document.body.querySelector<HTMLButtonElement>('.p-modal-close')?.click()
    expect(wrapper.emitted('cancel')).toHaveLength(2)
  })

  it('summarizes original and optional translation files', () => {
    mountPreview({
      originalFileName: 'song-original.lrc',
      translationFileName: 'song-zh.lrc',
    })

    expect(document.body.textContent).toContain('song-original.lrc')
    expect(document.body.textContent).toContain('song-zh.lrc')
  })

  it('uses the default empty translation filename summary', () => {
    mountPreview({ translationFileName: undefined })

    expect(document.body.textContent).toContain('original.lrc')
    expect(document.body.textContent).toContain('未选择')
  })

  it('uses a large modal above the player', () => {
    const wrapper = mountPreview()
    const modal = wrapper.findComponent(PModal)

    expect(modal.props('show')).toBe(true)
    expect(modal.props('size')).toBe('lg')
    expect(modal.props('abovePlayer')).toBe(true)
    expect(document.body.querySelector('.p-modal-lg')).not.toBeNull()
    expect(document.body.querySelector('.p-modal-backdrop--above-player')).not.toBeNull()
  })
})
