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

  it('shows and writes the same centisecond-rounded playback time while keeping selection', async () => {
    const wrapper = mountDrawer({
      content: '[00:01.00]Alpha\n[00:02.00]Beta',
      format: 'lrc',
      currentTimeSeconds: 3.256,
    })
    await wrapper.get('[data-testid="mode-timing"]').trigger('click')
    const secondId = draftRows(wrapper)[1]!.id
    await wrapper.get(`[data-testid="lyric-time-${secondId}"]`).trigger('focus')

    expect(wrapper.get('[data-testid="lyrics-current-time"]').text()).toBe('00:03.26')
    expect(wrapper.get('[data-testid="lyrics-write-current-time"]').attributes('aria-label')).toBe('写入当前播放时间')
    expect(wrapper.get('[data-testid="lyrics-write-current-time-next"]').attributes('aria-label')).toBe('写入当前播放时间并选择下一行')
    await wrapper.get('[data-testid="lyrics-write-current-time"]').trigger('click')

    expect(draftRows(wrapper)[1]!.timeMs).toBe(3260)
    expect(selectedRowId(wrapper)).toBe(secondId)
  })

  it('writes time, selects the next row, and focuses its time input', async () => {
    const wrapper = mountDrawer({
      content: '[00:01.00]Alpha\n[00:02.00]Beta\n[00:03.00]Gamma',
      format: 'lrc',
      currentTimeSeconds: 4.444,
    })
    await wrapper.get('[data-testid="mode-timing"]').trigger('click')
    const ids = draftRows(wrapper).map(row => row.id)
    const firstInput = wrapper.get(`[data-testid="lyric-time-${ids[0]}"]`)
    const nextInput = wrapper.get(`[data-testid="lyric-time-${ids[1]}"]`)
    document.body.appendChild(wrapper.get('.music-lyric-editor-drawer__row-editor').element)
    await firstInput.trigger('focus')
    await wrapper.get('[data-testid="lyrics-write-current-time-next"]').trigger('click')

    expect(draftRows(wrapper)[0]!.timeMs).toBe(4440)
    expect(selectedRowId(wrapper)).toBe(ids[1])
    expect(document.activeElement).toBe(nextInput.element)
  })

  it('writes the last row without adding or moving selection', async () => {
    const wrapper = mountDrawer({
      content: '[00:01.00]Alpha\n[00:02.00]Beta',
      format: 'lrc',
      currentTimeSeconds: 5,
    })
    await wrapper.get('[data-testid="mode-timing"]').trigger('click')
    const ids = draftRows(wrapper).map(row => row.id)
    await wrapper.get(`[data-testid="lyric-time-${ids[1]}"]`).trigger('focus')
    await wrapper.get('[data-testid="lyrics-write-current-time-next"]').trigger('click')

    expect(draftRows(wrapper)).toHaveLength(2)
    expect(draftRows(wrapper)[1]!.timeMs).toBe(5000)
    expect(selectedRowId(wrapper)).toBe(ids[1])
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

  it('keeps selection while sorting and switching edit targets', async () => {
    const wrapper = mountDrawer({ content: '[00:02.00]Two\n[00:01.00]One', format: 'lrc' })
    const selectedId = draftRows(wrapper)[0]!.id
    await wrapper.get(`[data-testid="lyric-original-${selectedId}"]`).trigger('focus')
    await buttonByText(wrapper, '按时间排序').trigger('click')
    expect(selectedRowId(wrapper)).toBe(selectedId)

    await wrapper.get('[data-testid="mode-timing"]').trigger('click')
    expect(selectedRowId(wrapper)).toBe(selectedId)
  })

  it('hides timing controls outside timing mode and disables them while saving or without rows', async () => {
    const plain = mountDrawer()
    expect(plain.find('[data-testid="lyrics-current-time"]').exists()).toBe(false)

    const saving = mountDrawer({ content: '[00:01.00]Alpha', format: 'lrc', saving: true })
    await saving.setProps({ saving: false })
    await saving.get('[data-testid="mode-timing"]').trigger('click')
    await saving.setProps({ saving: true })
    expect(saving.get<HTMLButtonElement>('[data-testid="lyrics-write-current-time"]').element.disabled).toBe(true)
    expect(saving.get<HTMLButtonElement>('[data-testid="lyrics-write-current-time-next"]').element.disabled).toBe(true)

    const empty = mountDrawer({ content: '', translation: '', format: 'lrc' })
    await empty.get('[data-testid="mode-timing"]').trigger('click')
    expect(empty.get<HTMLButtonElement>('[data-testid="lyrics-write-current-time"]').element.disabled).toBe(true)
    expect(empty.get<HTMLButtonElement>('[data-testid="lyrics-write-current-time-next"]').element.disabled).toBe(true)
  })

  it('forwards row seek events unchanged', () => {
    const wrapper = mountDrawer({ content: '[00:01.00]Alpha', format: 'lrc' })
    rowEditor(wrapper).vm.$emit('seek', 12.34)
    expect(wrapper.emitted('seek')).toEqual([[12.34]])
  })

  it('locks timing controls to accessible touch targets and mobile-safe layout', () => {
    expect(componentSource).toMatch(/\.music-lyric-editor-drawer__timing-actions\s*\{[^}]*gap:\s*8px;/s)
    expect(componentSource).toMatch(/\.music-lyric-editor-drawer__timing-actions\s+:deep\(\.p-button\)\s*\{[^}]*min-height:\s*44px;/s)
    expect(componentSource).toMatch(/\.music-lyric-editor-drawer__current-time\s*\{[^}]*font-variant-numeric:\s*tabular-nums;/s)
    expect(componentSource).toMatch(/@media \(max-width: 767px\)[\s\S]*\.music-lyric-editor-drawer__timing\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/)
    expect(componentSource).toMatch(/@media \(max-width: 767px\)[\s\S]*\.music-lyric-editor-drawer__timing-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/)
  })

  it('gives the sheet an accessible lyric editor title', () => {
    const wrapper = mountDrawer()
    expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('编辑歌词')
  })

  it('saves edited rows through the independent revision contract and trims the summary', async () => {
    const wrapper = mountDrawer()

    await wrapper.findAll('[data-testid^="lyric-original-"]')[0]!.setValue('Alpha edited')
    await wrapper.get('[data-testid="lyrics-edit-summary"]').setValue('  逐行修正  ')
    await wrapper.get('[data-testid="lyrics-save"]').trigger('click')

    expect(wrapper.emitted('save')?.[0]?.[0]).toEqual({
      target: 'original',
      language: undefined,
      baseVersion: 0,
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

  it('adds a row, switches target, and stably sorts LRC rows', async () => {
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

    await wrapper.get('[data-testid="mode-timing"]').trigger('click')
    expect(wrapper.findAll('button').some(button => button.text().trim() === '按时间排序')).toBe(false)
    expect(wrapper.findAll('[data-testid^="lyric-time-"]')).toHaveLength(4)
  })

  it('switches to translation when its field is selected and allows typing', async () => {
    const wrapper = mountDrawer()
    const translation = wrapper.find<HTMLInputElement>('[data-testid^="lyric-translation-"]')

    expect(translation.attributes()).toHaveProperty('readonly')
    await translation.trigger('pointerdown')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="mode-translation"]').attributes('aria-checked')).toBe('true')
    expect(translation.attributes()).not.toHaveProperty('readonly')
    await translation.setValue('新的翻译')
    expect(draftRows(wrapper)[0]?.translation).toBe('新的翻译')
  })

  it('parses an original LRC immediately and shows the result without a preview action', async () => {
    const wrapper = mountDrawer()
    const original = fileWithText('new.lrc', vi.fn().mockResolvedValue('[00:01.00]New'))

    await chooseFile(wrapper, '原文 LRC', original)
    expect(wrapper.get('input[aria-label="原文 LRC"]').attributes('accept')).toContain('.lrc')
    expect(wrapper.get('input[aria-label="翻译 LRC"]').attributes('accept')).toContain('.lrc')
    await vi.waitFor(() => expect(wrapper.find<HTMLInputElement>('[data-testid^="lyric-original-"]').element.value).toBe('New'))
    expect(wrapper.text()).toContain('已解析 1 行歌词')
    expect(wrapper.text()).toContain('new.lrc')
    expect(wrapper.text()).not.toContain('预览导入')
    expect(wrapper.find('[data-testid="lyrics-import-confirm"]').exists()).toBe(false)
  })

  it('reparses immediately after a translation LRC is selected', async () => {
    const wrapper = mountDrawer()
    await chooseFile(wrapper, '原文 LRC', fileWithText('new.lrc', vi.fn().mockResolvedValue('[00:01.00]New')))
    await chooseFile(wrapper, '翻译 LRC', fileWithText('new-zh.lrc', vi.fn().mockResolvedValue('[00:01.00]新')))

    await vi.waitFor(() => expect(wrapper.find<HTMLInputElement>('[data-testid^="lyric-translation-"]').element.value).toBe('新'))
    expect(wrapper.find<HTMLInputElement>('[data-testid^="lyric-original-"]').element.value).toBe('New')
    expect(rowEditor(wrapper).props('format')).toBe('lrc')
    expect(selectedRowId(wrapper)).toBe(draftRows(wrapper)[0]!.id)

    await wrapper.get('[data-testid="lyrics-edit-summary"]').setValue('导入双语歌词')
    await wrapper.get('[data-testid="lyrics-save"]').trigger('click')
    expect(wrapper.emitted('save')?.[0]?.[0]).toEqual({
      target: 'import',
      language: 'zh-CN',
      translationIncluded: true,
      baseVersion: 0,
      lines: [{ line_key: undefined, text: 'New', translation: '新', time_ms: 1000 }],
      editSummary: '导入双语歌词',
    })
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
    expect(wrapper.emitted('save')?.[0]?.[0]).toEqual({
      target: 'import',
      language: undefined,
      translationIncluded: false,
      baseVersion: 0,
      lines: [
        { line_key: undefined, text: 'Closed on Sunday', translation: '', time_ms: 29890 },
        { line_key: undefined, text: 'Chick-Fil-A', translation: '', time_ms: 150520 },
      ],
      editSummary: '导入歌词',
    })
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

    expect(wrapper.find<HTMLInputElement>('[data-testid^="lyric-translation-"]').element.value).toBe('甲')
    await wrapper.get('[data-testid="lyrics-edit-summary"]').setValue('更新原文时间轴')
    await wrapper.get('[data-testid="lyrics-save"]').trigger('click')
    expect(wrapper.emitted('save')?.[0]?.[0]).toEqual(expect.objectContaining({
      target: 'import',
      translationIncluded: false,
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
    expect(wrapper.get<HTMLInputElement>('input[aria-label="翻译 LRC"]').element.disabled).toBe(true)
    expect(buttonByText(wrapper, '增加行').attributes('disabled')).toBeDefined()
    expect(buttonByText(wrapper, '按时间排序').attributes('disabled')).toBeDefined()
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
