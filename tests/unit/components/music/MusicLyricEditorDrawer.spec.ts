import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MusicLyricEditorDrawer from '@/components/music/MusicLyricEditorDrawer.vue'
import MusicLyricsImportPreview from '@/components/music/MusicLyricsImportPreview.vue'
import { downloadTextFile } from '@/utils/textDownload'

vi.mock('@/utils/textDownload', () => ({ downloadTextFile: vi.fn() }))

const mounted: VueWrapper[] = []

function mountDrawer(props: Record<string, unknown> = {}) {
  const wrapper = mount(MusicLyricEditorDrawer, {
    props: {
      show: true,
      content: 'Alpha\nBeta',
      translation: '甲\n乙',
      format: 'plain',
      songTitle: 'Example Song',
      ...props,
    },
  })
  mounted.push(wrapper)
  return wrapper
}

function buttonByText(wrapper: VueWrapper, text: string) {
  const button = wrapper.findAll('button').find(item => item.text().trim() === text)
  if (!button) throw new Error(`Button not found: ${text}`)
  return button
}

function fileWithText(name: string, text: () => Promise<string>) {
  const file = new File([], name, { type: 'text/plain' })
  Object.defineProperty(file, 'text', { configurable: true, value: text })
  return file
}

async function chooseFile(wrapper: VueWrapper, label: string, file: File) {
  const input = wrapper.get<HTMLInputElement>(`input[aria-label="${label}"]`)
  Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
  await input.trigger('change')
}

beforeEach(() => vi.mocked(downloadTextFile).mockReset())

afterEach(() => {
  mounted.splice(0).forEach(wrapper => wrapper.unmount())
  document.body.innerHTML = ''
})

describe('MusicLyricEditorDrawer.vue', () => {
  it('saves edited rows through the existing payload contract and trims the summary', async () => {
    const wrapper = mountDrawer()

    await wrapper.findAll('[data-testid^="lyric-original-"]')[0]!.setValue('Alpha edited')
    await wrapper.get('[data-testid="lyrics-edit-summary"]').setValue('  逐行修正  ')
    await wrapper.get('[data-testid="lyrics-save"]').trigger('click')

    expect(wrapper.emitted('save')?.[0]?.[0]).toEqual({
      content: 'Alpha edited\nBeta',
      translation: '甲\n乙',
      format: 'plain',
      editSummary: '逐行修正',
    })
  })

  it('blocks an empty original row and shows its issue', async () => {
    const wrapper = mountDrawer({ content: 'Alpha\n', translation: '' })

    await wrapper.get('[data-testid="lyrics-edit-summary"]').setValue('修正')
    await wrapper.get('[data-testid="lyrics-save"]').trigger('click')

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.text()).toContain('原文不能为空')
  })

  it('blocks descending LRC time', async () => {
    const wrapper = mountDrawer({
      content: '[00:02.00]Two\n[00:01.00]One',
      translation: '',
      format: 'lrc',
    })

    await wrapper.get('[data-testid="lyrics-edit-summary"]').setValue('调整')
    await wrapper.get('[data-testid="lyrics-save"]').trigger('click')

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.text()).toContain('时间不能早于上一行')
  })

  it('allows save when duplicate LRC time only produces a warning', async () => {
    const wrapper = mountDrawer({
      content: '[00:01.00]One\n[00:01.00]Again',
      translation: '',
      format: 'lrc',
    })

    await wrapper.get('[data-testid="lyrics-edit-summary"]').setValue('保留重叠')
    expect(wrapper.text()).toContain('存在重复时间')
    expect(wrapper.get<HTMLButtonElement>('[data-testid="lyrics-save"]').element.disabled).toBe(false)
    await wrapper.get('[data-testid="lyrics-save"]').trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('adds a row, switches mode, and stably sorts LRC rows', async () => {
    const wrapper = mountDrawer({
      content: '[00:02.00]Two\n[00:01.00]One A\n[00:01.00]One B',
      translation: '',
      format: 'lrc',
    })

    expect(buttonByText(wrapper, '按时间排序').exists()).toBe(true)
    await buttonByText(wrapper, '按时间排序').trigger('click')
    expect(wrapper.findAll<HTMLInputElement>('[data-testid^="lyric-original-"]').map(input => input.element.value))
      .toEqual(['One A', 'One B', 'Two'])

    await buttonByText(wrapper, '增加行').trigger('click')
    expect(wrapper.findAll('[data-testid^="lyric-original-"]')).toHaveLength(4)

    await wrapper.get('[data-testid="mode-plain"]').trigger('click')
    expect(wrapper.findAll('button').some(button => button.text().trim() === '按时间排序')).toBe(false)
    expect(wrapper.findAll('[data-testid^="lyric-time-"]')).toHaveLength(0)
  })

  it('selects import files without changing rows and cancels preview without replacing', async () => {
    const wrapper = mountDrawer()
    const original = fileWithText('new.lrc', vi.fn().mockResolvedValue('[00:01.00]New'))
    const translation = fileWithText('new-zh.lrc', vi.fn().mockResolvedValue('[00:01.00]新'))

    await chooseFile(wrapper, '原文 LRC', original)
    await chooseFile(wrapper, '翻译 LRC', translation)
    expect(wrapper.get('input[aria-label="原文 LRC"]').attributes('accept')).toContain('.lrc')
    expect(wrapper.get('input[aria-label="翻译 LRC"]').attributes('accept')).toContain('.lrc')
    expect(wrapper.findAll<HTMLInputElement>('[data-testid^="lyric-original-"]')[0]!.element.value).toBe('Alpha')

    await buttonByText(wrapper, '预览导入').trigger('click')
    await vi.waitFor(() => expect(wrapper.findComponent(MusicLyricsImportPreview).props('show')).toBe(true))
    expect(wrapper.findComponent(MusicLyricsImportPreview).props('rows')[0].original).toBe('New')

    const cancel = Array.from(document.body.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === '取消')
    cancel?.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll<HTMLInputElement>('[data-testid^="lyric-original-"]')[0]!.element.value).toBe('Alpha')
  })

  it('confirms a valid bilingual import as the complete LRC draft', async () => {
    const wrapper = mountDrawer()
    await chooseFile(wrapper, '原文 LRC', fileWithText('new.lrc', vi.fn().mockResolvedValue('[00:01.00]New')))
    await chooseFile(wrapper, '翻译 LRC', fileWithText('new-zh.lrc', vi.fn().mockResolvedValue('[00:01.00]新')))

    await buttonByText(wrapper, '预览导入').trigger('click')
    await vi.waitFor(() => expect(document.body.querySelector('[data-testid="lyrics-import-confirm"]')).not.toBeNull())
    document.body.querySelector<HTMLButtonElement>('[data-testid="lyrics-import-confirm"]')?.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[data-testid^="lyric-original-"]')).toHaveLength(1)
    expect(wrapper.find<HTMLInputElement>('[data-testid^="lyric-original-"]').element.value).toBe('New')
    expect(wrapper.find<HTMLInputElement>('[data-testid^="lyric-translation-"]').element.value).toBe('新')
    expect(wrapper.get('[data-testid="mode-lrc"]').attributes('aria-checked')).toBe('true')
  })

  it('blocks import confirmation when imported rows fail lyric validation', async () => {
    const wrapper = mountDrawer()
    await chooseFile(wrapper, '原文 LRC', fileWithText('empty.lrc', vi.fn().mockResolvedValue('[00:01.00]')))

    await buttonByText(wrapper, '预览导入').trigger('click')
    await vi.waitFor(() => expect(document.body.textContent).toContain('原文不能为空'))

    expect(document.body.querySelector<HTMLButtonElement>('[data-testid="lyrics-import-confirm"]')?.disabled).toBe(true)
  })

  it('shows a file read error and keeps the draft', async () => {
    const wrapper = mountDrawer()
    await chooseFile(wrapper, '原文 LRC', fileWithText('broken.lrc', vi.fn().mockRejectedValue(new Error('failed'))))

    await buttonByText(wrapper, '预览导入').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('读取 LRC 文件失败'))
    expect(wrapper.findAll<HTMLInputElement>('[data-testid^="lyric-original-"]')[0]!.element.value).toBe('Alpha')
  })

  it('exports original and translated LRC files with the song title', async () => {
    const wrapper = mountDrawer({
      content: '[00:01.00]Alpha',
      translation: '[00:01.00]甲',
      format: 'lrc',
      songTitle: 'A/B',
    })

    await buttonByText(wrapper, '导出原文').trigger('click')
    await buttonByText(wrapper, '导出翻译').trigger('click')

    expect(downloadTextFile).toHaveBeenNthCalledWith(1, 'A/B', '[00:01.00]Alpha', '.lrc')
    expect(downloadTextFile).toHaveBeenNthCalledWith(2, 'A/B', '[00:01.00]甲', '-translation.lrc')
  })

  it('disables LRC exports until blocking time issues are fixed', async () => {
    const wrapper = mountDrawer({
      content: '[00:02.00]Two\n[00:01.00]One',
      translation: '',
      format: 'lrc',
    })

    expect(buttonByText(wrapper, '导出原文').attributes('disabled')).toBeDefined()
    expect(buttonByText(wrapper, '导出翻译').attributes('disabled')).toBeDefined()
    await buttonByText(wrapper, '导出原文').trigger('click')
    expect(downloadTextFile).not.toHaveBeenCalled()
  })

  it('does not show LRC export actions in plain mode', () => {
    const wrapper = mountDrawer()
    expect(wrapper.text()).not.toContain('导出原文')
    expect(wrapper.text()).not.toContain('导出翻译')
  })

  it('disables every mutating control while saving', () => {
    const wrapper = mountDrawer({ format: 'lrc', content: '[00:01.00]Alpha', saving: true })

    expect(wrapper.get('[data-testid="mode-plain"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get<HTMLInputElement>('input[aria-label="原文 LRC"]').element.disabled).toBe(true)
    expect(wrapper.get<HTMLInputElement>('input[aria-label="翻译 LRC"]').element.disabled).toBe(true)
    expect(buttonByText(wrapper, '增加行').attributes('disabled')).toBeDefined()
    expect(buttonByText(wrapper, '按时间排序').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('[data-testid^="lyric-original-"]').every(input => input.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.get('[data-testid="lyrics-edit-summary"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="lyrics-save"]').attributes('disabled')).toBeDefined()
  })

  it('resets summary, files, preview, and read errors when reopened from new props', async () => {
    const wrapper = mountDrawer()
    await wrapper.get('[data-testid="lyrics-edit-summary"]').setValue('local summary')
    await chooseFile(wrapper, '原文 LRC', fileWithText('broken.lrc', vi.fn().mockRejectedValue(new Error('failed'))))
    await buttonByText(wrapper, '预览导入').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('读取 LRC 文件失败'))

    await wrapper.setProps({ show: false })
    await wrapper.setProps({ content: 'Fresh', translation: '新', format: 'plain' })
    await wrapper.setProps({ show: true })

    expect(wrapper.get<HTMLInputElement>('[data-testid="lyrics-edit-summary"]').element.value).toBe('')
    expect(wrapper.get<HTMLInputElement>('input[aria-label="原文 LRC"]').element.value).toBe('')
    expect(wrapper.text()).not.toContain('读取 LRC 文件失败')
    expect(wrapper.find<HTMLInputElement>('[data-testid^="lyric-original-"]').element.value).toBe('Fresh')
    expect(wrapper.findComponent(MusicLyricsImportPreview).props('show')).toBe(false)
  })

  it('closes an open import preview when the drawer is reopened', async () => {
    const wrapper = mountDrawer()
    await chooseFile(wrapper, '原文 LRC', fileWithText('new.lrc', vi.fn().mockResolvedValue('[00:01.00]New')))
    await buttonByText(wrapper, '预览导入').trigger('click')
    await vi.waitFor(() => expect(wrapper.findComponent(MusicLyricsImportPreview).props('show')).toBe(true))

    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true })

    expect(wrapper.findComponent(MusicLyricsImportPreview).props('show')).toBe(false)
    expect(wrapper.get<HTMLInputElement>('input[aria-label="原文 LRC"]').element.value).toBe('')
  })
})
