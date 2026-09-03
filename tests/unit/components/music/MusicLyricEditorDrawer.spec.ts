import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MusicLyricEditorDrawer from '@/components/music/MusicLyricEditorDrawer.vue'
import MusicLyricsRowEditor from '@/components/music/MusicLyricsRowEditor.vue'
import * as musicLyricsDraft from '@/utils/musicLyricsDraft'
import { downloadTextFile } from '@/utils/textDownload'
import componentSource from '@/components/music/MusicLyricEditorDrawer.vue?raw'

vi.mock('@/utils/textDownload', () => ({ downloadTextFile: vi.fn() }))

const mounted: VueWrapper[] = []

type DraftRow = { id: string, timeMs: number | null, original: string, translation: string }

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

function rowEditor(wrapper: VueWrapper) {
  return wrapper.getComponent(MusicLyricsRowEditor)
}

function draftRows(wrapper: VueWrapper): DraftRow[] {
  return rowEditor(wrapper).props('rows') as DraftRow[]
}

function selectedRowId(wrapper: VueWrapper): string {
  return rowEditor(wrapper).props('selectedRowId') as string
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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
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
  it('接受拖入的原文 LRC 文件', async () => {
    const wrapper = mountDrawer({ content: '', translation: '', format: 'plain' })
    const file = fileWithText('original.lrc', async () => '[00:01.00]Alpha')

    await wrapper.get('[aria-label="导入 LRC"] .music-lyric-editor-drawer__file-field').trigger('drop', {
      dataTransfer: { files: [file] },
    })

    expect(draftRows(wrapper)[0]).toMatchObject({ original: 'Alpha', timeMs: 1000 })
  })

  it('仅在翻译标签显示翻译 LRC 拖拽入口', async () => {
    const wrapper = mountDrawer()
    expect(wrapper.find('input[aria-label="翻译 LRC"]').exists()).toBe(false)

    await wrapper.get('[data-testid="mode-translation"]').trigger('click')
    expect(wrapper.get('input[aria-label="翻译 LRC"]').exists()).toBe(true)
  })

  it('defaults the current playback time to zero', () => {
    const wrapper = mountDrawer()
    expect(wrapper.props('currentTimeSeconds')).toBe(0)
  })

  it('selects the first untimed row, falls back to the first timed row, and resets on reopen', async () => {
    const parseDraft = vi.spyOn(musicLyricsDraft, 'parseMusicLyricDraft').mockReturnValueOnce([
      { id: 'timed-first', timeMs: 1000, original: 'Timed', translation: '' },
      { id: 'untimed-second', timeMs: null, original: 'Untimed', translation: '' },
    ])
    const untimed = mountDrawer({ content: 'Alpha\nBeta', format: 'plain' })
    expect(selectedRowId(untimed)).toBe('untimed-second')
    parseDraft.mockRestore()

    const timed = mountDrawer({ content: '[00:01.00]Alpha\n[00:02.00]Beta', format: 'lrc' })
    expect(selectedRowId(timed)).toBe(draftRows(timed)[0]!.id)

    const previousIds = draftRows(timed).map(row => row.id)
    await timed.get(`[data-testid="lyric-original-${previousIds[1]}"]`).trigger('focus')
    expect(selectedRowId(timed)).toBe(previousIds[1])
    await timed.setProps({ show: false })
    await timed.setProps({ content: '[00:03.00]Fresh', show: true })

    expect(draftRows(timed)).toHaveLength(1)
    expect(selectedRowId(timed)).toBe(draftRows(timed)[0]!.id)
    expect(selectedRowId(timed)).not.toBe(previousIds[1])
  })

  it('edits timing in original mode and only displays it in translation mode', async () => {
    const wrapper = mountDrawer({ content: '[00:01.00]Alpha', translation: '[00:01.00]甲', format: 'lrc' })
    const rowId = draftRows(wrapper)[0]!.id
    await wrapper.get(`[data-testid="lyric-time-${rowId}"]`).setValue('00:02.50')
    expect(draftRows(wrapper)[0]!.timeMs).toBe(2500)

    await wrapper.get('[data-testid="mode-translation"]').trigger('click')
    expect(wrapper.find(`[data-testid="lyric-time-${rowId}"]`).exists()).toBe(false)
    expect(wrapper.text()).toContain('00:02.50')
    expect(wrapper.get<HTMLInputElement>(`[data-testid="lyric-original-${rowId}"]`).element.readOnly).toBe(true)
    await wrapper.get(`[data-testid="lyric-translation-${rowId}"]`).setValue('新翻译')
    expect(draftRows(wrapper)[0]!.translation).toBe('新翻译')
  })

  it('空歌词可以从当前播放时间开始打点并输入', async () => {
    const wrapper = mountDrawer({ content: '', translation: '', format: 'plain', currentTimeSeconds: 12.345 })
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus')

    await buttonByText(wrapper, '打点并输入').trigger('click')

    expect(rowEditor(wrapper).props('format')).toBe('lrc')
    expect(draftRows(wrapper)).toHaveLength(1)
    expect(draftRows(wrapper)[0]).toMatchObject({ timeMs: 12_345, original: '' })
    expect(focusSpy).toHaveBeenCalled()
    focusSpy.mockRestore()
  })

  it('纯文本歌词开始对时后，打点会自动选择下一条未打点行', async () => {
    const wrapper = mountDrawer({ content: 'Alpha\nBeta', translation: '', format: 'plain', currentTimeSeconds: 8.2 })
    const ids = draftRows(wrapper).map(row => row.id)

    await buttonByText(wrapper, '开始对时').trigger('click')
    expect(rowEditor(wrapper).props('format')).toBe('lrc')
    expect(selectedRowId(wrapper)).toBe(ids[0])

    await buttonByText(wrapper, '打点 (00:08.20)').trigger('click')
    expect(draftRows(wrapper).map(row => row.timeMs)).toEqual([8_200, null])
    expect(selectedRowId(wrapper)).toBe(ids[1])
  })

  it('可以单独或整体微调 LRC 时间轴', async () => {
    const wrapper = mountDrawer({ content: '[00:01.00]Alpha\n[00:02.00]Beta', format: 'lrc' })
    const ids = draftRows(wrapper).map(row => row.id)

    const tools = wrapper.get('[data-testid="lyric-editor-tools"]')
    expect(tools.text()).toContain('整体偏移')
    expect(tools.get('button[title="全部提前 0.1 秒"]').exists()).toBe(true)
    expect(tools.get('.music-lyric-editor-drawer__tools-primary').exists()).toBe(true)
    expect(tools.get('.music-lyric-editor-drawer__add-row').exists()).toBe(true)
    expect(wrapper.find('.music-lyric-editor-drawer__toolbar-actions').exists()).toBe(false)
    expect(wrapper.find('.lyric-editor-tools').element.compareDocumentPosition(wrapper.find('.lyric-grid-header').element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const summaryField = wrapper.get('[data-testid="lyrics-edit-summary"]').element.closest('.p-field')
    expect(summaryField?.querySelector('label')?.textContent).toContain('修改原因')

    await wrapper.get(`[data-testid="lyric-adjust-up-${ids[0]}"]`).trigger('click')
    expect(draftRows(wrapper).map(row => row.timeMs)).toEqual([1_100, 2_000])

    await wrapper.get('button[title="全部提前 0.1 秒"]').trigger('click')
    expect(draftRows(wrapper).map(row => row.timeMs)).toEqual([1_000, 1_900])

    await wrapper.get('button[title="全部延后 0.1 秒"]').trigger('click')
    expect(draftRows(wrapper).map(row => row.timeMs)).toEqual([1_100, 2_000])
  })

  it('原文输入按 Enter 会进入下一行，末行会自动增加一行', async () => {
    const wrapper = mountDrawer({ content: 'Alpha', format: 'plain' })
    const firstId = draftRows(wrapper)[0]!.id

    await wrapper.get(`[data-testid="lyric-original-${firstId}"]`).trigger('keydown.enter')

    expect(draftRows(wrapper)).toHaveLength(2)
    expect(selectedRowId(wrapper)).toBe(draftRows(wrapper)[1]!.id)
  })

  it('selects a newly added row', async () => {
    const wrapper = mountDrawer({ content: '[00:01.00]Alpha', format: 'lrc' })
    await buttonByText(wrapper, '增加行').trigger('click')

    expect(selectedRowId(wrapper)).toBe(draftRows(wrapper).at(-1)!.id)
  })

  it('selects the next row after deleting a selected middle row', async () => {
    const wrapper = mountDrawer({ content: '[00:01.00]A\n[00:02.00]B\n[00:03.00]C', format: 'lrc' })
    const ids = draftRows(wrapper).map(row => row.id)
    await wrapper.get(`[data-testid="lyric-original-${ids[1]}"]`).trigger('focus')
    await wrapper.get(`[data-testid="lyric-delete-${ids[1]}"]`).trigger('click')

    expect(selectedRowId(wrapper)).toBe(ids[2])
  })

  it('selects the previous row after deleting the selected last row', async () => {
    const wrapper = mountDrawer({ content: '[00:01.00]A\n[00:02.00]B\n[00:03.00]C', format: 'lrc' })
    const ids = draftRows(wrapper).map(row => row.id)
    await wrapper.get(`[data-testid="lyric-original-${ids[2]}"]`).trigger('focus')
    await wrapper.get(`[data-testid="lyric-delete-${ids[2]}"]`).trigger('click')

    expect(selectedRowId(wrapper)).toBe(ids[1])
  })

  it('keeps selection when another row is deleted', async () => {
    const wrapper = mountDrawer({ content: '[00:01.00]A\n[00:02.00]B\n[00:03.00]C', format: 'lrc' })
    const ids = draftRows(wrapper).map(row => row.id)
    await wrapper.get(`[data-testid="lyric-original-${ids[1]}"]`).trigger('focus')
    await wrapper.get(`[data-testid="lyric-delete-${ids[0]}"]`).trigger('click')

    expect(selectedRowId(wrapper)).toBe(ids[1])
  })

  it('keeps the same row selected while editing and moving it', async () => {
    const wrapper = mountDrawer({ content: '[00:01.00]A\n[00:02.00]B\n[00:03.00]C', format: 'lrc' })
    const ids = draftRows(wrapper).map(row => row.id)
    await wrapper.get(`[data-testid="lyric-original-${ids[1]}"]`).trigger('focus')

    await wrapper.get(`[data-testid="lyric-original-${ids[1]}"]`).setValue('B edited')
    expect(selectedRowId(wrapper)).toBe(ids[1])

    await wrapper.get(`[data-testid="lyric-move-down-${ids[1]}"]`).trigger('click')
    expect(draftRows(wrapper).map(row => row.id)).toEqual([ids[0], ids[2], ids[1]])
    expect(selectedRowId(wrapper)).toBe(ids[1])
  })

  it('keeps selection while switching edit targets', async () => {
    const wrapper = mountDrawer({ content: '[00:02.00]Two\n[00:01.00]One', format: 'lrc' })
    const selectedId = draftRows(wrapper)[0]!.id
    await wrapper.get(`[data-testid="lyric-original-${selectedId}"]`).trigger('focus')

    await wrapper.get('[data-testid="mode-translation"]').trigger('click')
    expect(selectedRowId(wrapper)).toBe(selectedId)
  })

  it('forwards row seek events unchanged', () => {
    const wrapper = mountDrawer({ content: '[00:01.00]Alpha', format: 'lrc' })
    rowEditor(wrapper).vm.$emit('seek', 12.34)
    expect(wrapper.emitted('seek')).toEqual([[12.34]])
  })


  it('gives the sheet an accessible lyric editor title', () => {
    const wrapper = mountDrawer()
    expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('歌词-Example Song')
  })

  it('saves edited rows through the independent revision contract and trims the summary', async () => {
    const wrapper = mountDrawer()

    await wrapper.findAll('[data-testid^="lyric-original-"]')[0]!.setValue('Alpha edited')
    await wrapper.get('[data-testid="lyrics-edit-summary"]').setValue('  逐行修正  ')
    await wrapper.get('[data-testid="lyrics-save"]').trigger('click')

    expect(wrapper.emitted('save')?.[0]?.[0]).toEqual({
      target: 'all',
      language: 'zh-CN',
      baseVersion: 0,
      content: 'Alpha edited\nBeta',
      translation: '甲\n乙',
      format: 'plain',
      lines: [
        { line_key: undefined, text: 'Alpha edited', translation: '甲', time_ms: null },
        { line_key: undefined, text: 'Beta', translation: '乙', time_ms: null },
      ],
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

  it('does not offer time sorting and still allows adding an LRC row', async () => {
    const wrapper = mountDrawer({
      content: '[00:02.00]Two\n[00:01.00]One A\n[00:01.00]One B',
      translation: '',
      format: 'lrc',
    })

    expect(wrapper.findAll('button').some(button => button.text().trim() === '按时间排序')).toBe(false)
    expect(wrapper.findAll<HTMLInputElement>('[data-testid^="lyric-original-"]').map(input => input.element.value))
      .toEqual(['Two', 'One A', 'One B'])

    await buttonByText(wrapper, '增加行').trigger('click')
    expect(wrapper.findAll('[data-testid^="lyric-original-"]')).toHaveLength(4)

    expect(wrapper.findAll('[data-testid^="lyric-time-"]')).toHaveLength(4)
  })

  it('shows translation only after explicitly switching mode', async () => {
    const wrapper = mountDrawer()
    expect(wrapper.find('[data-testid^="lyric-translation-"]').exists()).toBe(false)
    await wrapper.get('[data-testid="mode-translation"]').trigger('click')

    expect(wrapper.get('[data-testid="mode-translation"]').attributes('aria-checked')).toBe('true')
    const translation = wrapper.get<HTMLInputElement>('[data-testid^="lyric-translation-"]')
    await translation.setValue('新的翻译')
    expect(draftRows(wrapper)[0]?.translation).toBe('新的翻译')
  })

  it('parses an original LRC immediately and shows the result without a preview action', async () => {
    const wrapper = mountDrawer()
    const original = fileWithText('new.lrc', vi.fn().mockResolvedValue('[00:01.00]New'))

    await chooseFile(wrapper, '原文 LRC', original)
    expect(wrapper.get('input[aria-label="原文 LRC"]').attributes('accept')).toContain('.lrc')
    expect(wrapper.find('input[aria-label="翻译 LRC"]').exists()).toBe(false)
    await vi.waitFor(() => expect(wrapper.find<HTMLInputElement>('[data-testid^="lyric-original-"]').element.value).toBe('New'))
    expect(wrapper.text()).toContain('已解析 1 行歌词')
    expect(wrapper.text()).toContain('new.lrc')
    expect(wrapper.findAll('button').some(button => button.text().trim() === '重新选择')).toBe(true)
    expect(wrapper.text()).not.toContain('预览导入')
    expect(wrapper.find('[data-testid="lyrics-import-confirm"]').exists()).toBe(false)
  })

  it('reparses immediately after a translation LRC is selected', async () => {
    const wrapper = mountDrawer()
    await chooseFile(wrapper, '原文 LRC', fileWithText('new.lrc', vi.fn().mockResolvedValue('[00:01.00]New')))
    await wrapper.get('[data-testid="mode-translation"]').trigger('click')
    await chooseFile(wrapper, '翻译 LRC', fileWithText('new-zh.lrc', vi.fn().mockResolvedValue('[00:01.00]新')))

    await vi.waitFor(() => expect(wrapper.find<HTMLInputElement>('[data-testid^="lyric-translation-"]').element.value).toBe('新'))
    expect(wrapper.find<HTMLInputElement>('[data-testid^="lyric-original-"]').element.value).toBe('New')
    expect(rowEditor(wrapper).props('format')).toBe('lrc')
    expect(selectedRowId(wrapper)).toBe(draftRows(wrapper)[0]!.id)

    await wrapper.get('[data-testid="lyrics-edit-summary"]').setValue('导入双语歌词')
    await wrapper.get('[data-testid="lyrics-save"]').trigger('click')
    expect(wrapper.emitted('save')?.[0]?.[0]).toEqual(expect.objectContaining({
      target: 'all',
      language: 'zh-CN',
      baseVersion: 0,
      content: '[00:01.00]New',
      translation: '[00:01.00]新',
      format: 'lrc',
      lines: [{ line_key: undefined, text: 'New', translation: '新', time_ms: 1000 }],
      editSummary: '导入双语歌词',
    }))
  })

  it('imports a real LRC into an empty song without empty-original errors', async () => {
    const wrapper = mountDrawer({
      content: '',
      translation: '',
      format: 'plain',
      version: 0,
    })
    expect(draftRows(wrapper)).toEqual([])
    expect(wrapper.text()).not.toContain('原文不能为空')

    const content = [
      '[id: ngirwxkr]',
      '[ar: Kanye West]',
      '[length: 02:32]',
      '[00:29.89]Closed on Sunday',
      '[01:28.20]',
      '[02:30.52]Chick-Fil-A',
    ].join('\n')
    await chooseFile(wrapper, '原文 LRC', fileWithText('Closed On Sunday.lrc', vi.fn().mockResolvedValue(content)))
    await vi.waitFor(() => expect(draftRows(wrapper)).toHaveLength(2))

    await wrapper.get('[data-testid="lyrics-edit-summary"]').setValue('导入歌词')
    await wrapper.get('[data-testid="lyrics-save"]').trigger('click')
    expect(wrapper.emitted('save')?.[0]?.[0]).toEqual(expect.objectContaining({
      target: 'all',
      language: undefined,
      baseVersion: 0,
      format: 'lrc',
      lines: [
        { line_key: undefined, text: 'Closed on Sunday', translation: '', time_ms: 29890 },
        { line_key: undefined, text: 'Chick-Fil-A', translation: '', time_ms: 150520 },
      ],
      editSummary: '导入歌词',
    }))
  })

  it('preserves matching translation and saves one atomic import without a translation file', async () => {
    const wrapper = mountDrawer({
      content: '[00:01.00]Alpha',
      translation: '[00:01.00]甲',
      format: 'lrc',
      version: 3,
      lines: [{ line_key: 'line-alpha', line_index: 0, time_ms: 1000, text: 'Alpha', translation: '甲' }],
    })
    await chooseFile(wrapper, '原文 LRC', fileWithText('new.lrc', vi.fn().mockResolvedValue('[00:02.00]Alpha')))
    await vi.waitFor(() => expect(draftRows(wrapper)[0]?.timeMs).toBe(2000))

    expect(draftRows(wrapper)[0]?.translation).toBe('甲')
    await wrapper.get('[data-testid="lyrics-edit-summary"]').setValue('更新原文时间轴')
    await wrapper.get('[data-testid="lyrics-save"]').trigger('click')
    expect(wrapper.emitted('save')?.[0]?.[0]).toEqual(expect.objectContaining({
      target: 'all',
      baseVersion: 3,
      lines: [{ line_key: 'line-alpha', text: 'Alpha', translation: '甲', time_ms: 2000 }],
    }))
  })

  it('keeps the current draft and reports an LRC with no importable rows', async () => {
    const wrapper = mountDrawer()
    await chooseFile(wrapper, '原文 LRC', fileWithText('empty.lrc', vi.fn().mockResolvedValue('[00:01.00]')))

    await vi.waitFor(() => expect(wrapper.text()).toContain('未找到可导入的歌词'))
    expect(wrapper.find<HTMLInputElement>('[data-testid^="lyric-original-"]').element.value).toBe('Alpha')
  })

  it('names the original file when reading it fails and keeps the draft', async () => {
    const wrapper = mountDrawer()
    await chooseFile(wrapper, '原文 LRC', fileWithText('broken-original.lrc', vi.fn().mockRejectedValue(new Error('failed'))))

    await vi.waitFor(() => expect(wrapper.text()).toContain('读取 LRC 文件失败：broken-original.lrc'))
    expect(wrapper.findAll<HTMLInputElement>('[data-testid^="lyric-original-"]')[0]!.element.value).toBe('Alpha')
  })

  it('names the translation file when reading it fails', async () => {
    const wrapper = mountDrawer()
    await chooseFile(wrapper, '原文 LRC', fileWithText('original.lrc', vi.fn().mockResolvedValue('[00:01.00]Alpha')))
    await wrapper.get('[data-testid="mode-translation"]').trigger('click')
    await chooseFile(wrapper, '翻译 LRC', fileWithText('broken-translation.lrc', vi.fn().mockRejectedValue(new Error('failed'))))

    await vi.waitFor(() => expect(wrapper.text()).toContain('读取 LRC 文件失败：broken-translation.lrc'))
  })

  it('adds the original filename and physical line to original parse errors', async () => {
    const wrapper = mountDrawer()
    await chooseFile(
      wrapper,
      '原文 LRC',
      fileWithText('broken-original.lrc', vi.fn().mockResolvedValue('[00:01.00]Alpha\nnot-lrc')),
    )

    await vi.waitFor(() => expect(wrapper.text()).toContain('broken-original.lrc 第 2 行'))
  })

  it('adds the translation filename and physical line to translation parse errors', async () => {
    const wrapper = mountDrawer()
    await chooseFile(wrapper, '原文 LRC', fileWithText('original.lrc', vi.fn().mockResolvedValue('[00:01.00]Alpha')))
    await wrapper.get('[data-testid="mode-translation"]').trigger('click')
    await chooseFile(
      wrapper,
      '翻译 LRC',
      fileWithText('broken-translation.lrc', vi.fn().mockResolvedValue('[00:01.00]甲\nnot-lrc')),
    )

    await vi.waitFor(() => expect(wrapper.text()).toContain('broken-translation.lrc 第 2 行'))
  })

  it('keeps the newest parsed result when an older file read finishes later', async () => {
    const wrapper = mountDrawer()
    const firstRead = deferred<string>()
    const secondRead = deferred<string>()

    await chooseFile(wrapper, '原文 LRC', fileWithText('first.lrc', () => firstRead.promise))
    await chooseFile(wrapper, '原文 LRC', fileWithText('second.lrc', () => secondRead.promise))

    secondRead.resolve('[00:02.00]Second')
    await vi.waitFor(() => {
      expect(draftRows(wrapper)[0]?.original).toBe('Second')
      expect(wrapper.text()).toContain('second.lrc')
    })

    firstRead.resolve('[00:01.00]First')
    await firstRead.promise
    await wrapper.vm.$nextTick()
    expect(draftRows(wrapper)[0]?.original).toBe('Second')
    expect(wrapper.text()).toContain('second.lrc')
  })

  it('ignores a pending import failure after the drawer closes', async () => {
    const wrapper = mountDrawer()
    const pendingRead = deferred<string>()
    await chooseFile(wrapper, '原文 LRC', fileWithText('pending.lrc', () => pendingRead.promise))

    await wrapper.setProps({ show: false })
    pendingRead.reject(new Error('late failure'))
    await pendingRead.promise.catch(() => undefined)
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as unknown as { importIssues: unknown[] }).importIssues).toEqual([])
    expect((wrapper.vm as unknown as { importError: string }).importError).toBe('')
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

  it('shows download failures, clears them after success, and resets them when reopened', async () => {
    const wrapper = mountDrawer({
      content: '[00:01.00]Alpha',
      translation: '[00:01.00]甲',
      format: 'lrc',
    })
    vi.mocked(downloadTextFile).mockImplementationOnce(() => {
      throw new Error('download failed')
    })

    await buttonByText(wrapper, '导出原文').trigger('click')
    expect(wrapper.get('[role="alert"]').text()).toContain('导出歌词失败，请重试')

    await buttonByText(wrapper, '导出原文').trigger('click')
    expect(wrapper.text()).not.toContain('导出歌词失败，请重试')

    vi.mocked(downloadTextFile).mockImplementationOnce(() => {
      throw new Error('download failed again')
    })
    await buttonByText(wrapper, '导出翻译').trigger('click')
    expect(wrapper.text()).toContain('导出歌词失败，请重试')
    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true })
    expect(wrapper.text()).not.toContain('导出歌词失败，请重试')
  })

  it('does not show LRC export actions in plain mode', () => {
    const wrapper = mountDrawer()
    expect(wrapper.text()).not.toContain('导出原文')
    expect(wrapper.text()).not.toContain('导出翻译')
  })

  it('disables every mutating control while saving', () => {
    const wrapper = mountDrawer({ format: 'lrc', content: '[00:01.00]Alpha', saving: true })

    expect(wrapper.get('[data-testid="mode-original"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get<HTMLInputElement>('input[aria-label="原文 LRC"]').element.disabled).toBe(true)
    expect(wrapper.find('input[aria-label="翻译 LRC"]').exists()).toBe(false)
    expect(buttonByText(wrapper, '增加行').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('button').some(button => button.text().trim() === '按时间排序')).toBe(false)
    expect(wrapper.findAll('[data-testid^="lyric-original-"]').every(input => input.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.get('[data-testid="lyrics-edit-summary"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="lyrics-save"]').attributes('disabled')).toBeDefined()
  })

  it('resets summary, files, import state, and read errors when reopened from new props', async () => {
    const wrapper = mountDrawer()
    await wrapper.get('[data-testid="lyrics-edit-summary"]').setValue('local summary')
    await chooseFile(wrapper, '原文 LRC', fileWithText('broken.lrc', vi.fn().mockRejectedValue(new Error('failed'))))
    await vi.waitFor(() => expect(wrapper.text()).toContain('读取 LRC 文件失败'))

    await wrapper.setProps({ show: false })
    await wrapper.setProps({ content: 'Fresh', translation: '新', format: 'plain' })
    await wrapper.setProps({ show: true })

    expect(wrapper.get<HTMLInputElement>('[data-testid="lyrics-edit-summary"]').element.value).toBe('')
    expect(wrapper.get<HTMLInputElement>('input[aria-label="原文 LRC"]').element.value).toBe('')
    expect(wrapper.text()).not.toContain('读取 LRC 文件失败')
    expect(wrapper.find<HTMLInputElement>('[data-testid^="lyric-original-"]').element.value).toBe('Fresh')
    expect(wrapper.text()).not.toContain('已解析')
  })

  it('resets an imported file when the drawer is reopened', async () => {
    const wrapper = mountDrawer()
    await chooseFile(wrapper, '原文 LRC', fileWithText('new.lrc', vi.fn().mockResolvedValue('[00:01.00]New')))
    await vi.waitFor(() => expect(wrapper.text()).toContain('已解析 1 行歌词'))

    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true })

    expect(wrapper.text()).not.toContain('已解析')
    expect(wrapper.get<HTMLInputElement>('input[aria-label="原文 LRC"]').element.value).toBe('')
  })
})
