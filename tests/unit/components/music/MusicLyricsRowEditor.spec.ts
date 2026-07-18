import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MusicLyricsRowEditor from '@/components/music/MusicLyricsRowEditor.vue'
import componentSource from '@/components/music/MusicLyricsRowEditor.vue?raw'
import type { MusicLyricDraftIssue, MusicLyricDraftRow } from '@/utils/musicLyricsDraft'

const rows: MusicLyricDraftRow[] = [
  { id: 'first', timeMs: 1_000, original: '第一句', translation: 'First line' },
  { id: 'second', timeMs: 2_000, original: '第二句', translation: 'Second line' },
  { id: 'third', timeMs: 3_000, original: '第三句', translation: 'Third line' },
]

function mountEditor(options: {
  rows?: MusicLyricDraftRow[]
  format?: 'plain' | 'lrc'
  issues?: MusicLyricDraftIssue[]
  disabled?: boolean
} = {}) {
  return mount(MusicLyricsRowEditor, {
    props: {
      rows: options.rows ?? rows,
      format: options.format ?? 'plain',
      issues: options.issues,
      disabled: options.disabled,
    },
  })
}

function lastRows(wrapper: ReturnType<typeof mountEditor>): MusicLyricDraftRow[] {
  const events = wrapper.emitted<MusicLyricDraftRow[]>('update:rows')
  expect(events).toBeTruthy()
  return events!.at(-1)![0]
}

describe('MusicLyricsRowEditor', () => {
  it('编辑原文和翻译时发射新数组且不修改 props', async () => {
    const inputRows = rows.map((row) => ({ ...row }))
    const wrapper = mountEditor({ rows: inputRows })

    await wrapper.get('[data-testid="lyric-original-first"]').setValue('修改后的原文')
    const originalUpdate = lastRows(wrapper)

    expect(inputRows[0].original).toBe('第一句')
    expect(originalUpdate).not.toBe(inputRows)
    expect(originalUpdate[0]).not.toBe(inputRows[0])
    expect(originalUpdate[0].original).toBe('修改后的原文')

    await wrapper.get('[data-testid="lyric-translation-first"]').setValue('Updated translation')
    const translationUpdate = lastRows(wrapper)

    expect(inputRows[0].translation).toBe('First line')
    expect(translationUpdate[0].translation).toBe('Updated translation')
  })

  it('plain 隐藏时间，lrc 显示格式化时间并解析输入', async () => {
    const wrapper = mountEditor({ format: 'plain' })
    expect(wrapper.find('[data-testid="lyric-time-first"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('时间')

    await wrapper.setProps({ format: 'lrc' })
    const timeInput = wrapper.get('[data-testid="lyric-time-first"]')
    expect((timeInput.element as HTMLInputElement).value).toBe('00:01.00')

    await timeInput.setValue('00:03.25')
    expect(lastRows(wrapper)[0].timeMs).toBe(3_250)
  })

  it('保留非空非法时间原文、显示错误并发射 null', async () => {
    const wrapper = mountEditor({ format: 'lrc' })
    const timeInput = wrapper.get('[data-testid="lyric-time-first"]')

    await timeInput.setValue('not-a-time')

    expect((timeInput.element as HTMLInputElement).value).toBe('not-a-time')
    expect(wrapper.text()).toContain('时间格式无效')
    expect(lastRows(wrapper)[0].timeMs).toBeNull()
  })

  it('rows 与 format 变化时同步时间输入缓存', async () => {
    const wrapper = mountEditor({ format: 'lrc' })
    await wrapper.get('[data-testid="lyric-time-first"]').setValue('invalid')

    await wrapper.setProps({
      rows: [{ ...rows[0], timeMs: 9_000 }, ...rows.slice(1)],
    })
    expect((wrapper.get('[data-testid="lyric-time-first"]').element as HTMLInputElement).value).toBe('00:09.00')

    await wrapper.setProps({ format: 'plain' })
    expect(wrapper.find('[data-testid="lyric-time-first"]').exists()).toBe(false)
    await wrapper.setProps({ format: 'lrc' })
    expect((wrapper.get('[data-testid="lyric-time-first"]').element as HTMLInputElement).value).toBe('00:09.00')
  })

  it('上下移动遵守边界并按新顺序发射', async () => {
    const wrapper = mountEditor()
    const firstUp = wrapper.get('[data-testid="lyric-move-up-first"]')
    const lastDown = wrapper.get('[data-testid="lyric-move-down-third"]')

    expect(firstUp.attributes()).toHaveProperty('disabled')
    expect(lastDown.attributes()).toHaveProperty('disabled')
    await firstUp.trigger('click')
    await lastDown.trigger('click')
    expect(wrapper.emitted('update:rows')).toBeUndefined()

    await wrapper.get('[data-testid="lyric-move-down-first"]').trigger('click')
    expect(lastRows(wrapper).map((row) => row.id)).toEqual(['second', 'first', 'third'])

    await wrapper.get('[data-testid="lyric-move-up-second"]').trigger('click')
    expect(lastRows(wrapper).map((row) => row.id)).toEqual(['second', 'first', 'third'])
  })

  it('删除指定行并发射剩余行', async () => {
    const wrapper = mountEditor()

    await wrapper.get('[data-testid="lyric-delete-second"]').trigger('click')

    expect(lastRows(wrapper).map((row) => row.id)).toEqual(['first', 'third'])
    expect(rows).toHaveLength(3)
  })

  it('disabled 时禁用全部输入和操作按钮', () => {
    const wrapper = mountEditor({ format: 'lrc', disabled: true })

    for (const control of wrapper.findAll('input, button')) {
      expect(control.attributes()).toHaveProperty('disabled')
    }
  })

  it('按 rowIndex 展示 error 和 warning', () => {
    const wrapper = mountEditor({
      issues: [
        { severity: 'error', code: 'empty', message: '原文不能为空', rowIndex: 0 },
        { severity: 'warning', code: 'duplicate', message: '存在重复时间', rowIndex: 1 },
        { severity: 'error', code: 'global', message: '不属于任何行' },
      ],
    })

    const firstRow = wrapper.get('[data-testid="lyric-row-first"]')
    const secondRow = wrapper.get('[data-testid="lyric-row-second"]')
    expect(firstRow.get('[data-severity="error"]').text()).toBe('原文不能为空')
    expect(secondRow.get('[data-severity="warning"]').text()).toBe('存在重复时间')
    expect(wrapper.text()).not.toContain('不属于任何行')
  })

  it('使用稳定桌面网格和 767px 以下纵向布局', () => {
    const wrapper = mountEditor({ format: 'lrc' })

    expect(wrapper.get('[data-testid="lyric-editor-grid"]').classes()).toContain('is-lrc')
    expect(wrapper.get('[data-testid="lyric-row-first"]').classes()).toContain('lyric-row')
    expect(wrapper.get('[data-testid="lyric-move-up-first"]').attributes('title')).toBe('上移')
    expect(wrapper.get('[data-testid="lyric-move-up-first"]').attributes('aria-label')).toBe('上移第 1 行')
    expect(wrapper.get('[data-testid="lyric-delete-first"] svg').exists()).toBe(true)

    expect(componentSource).toMatch(/grid-template-columns/)
    expect(componentSource).toMatch(/@media\s*\(max-width:\s*767px\)/)
    expect(componentSource).toMatch(/overflow-x:\s*hidden/)
    expect(componentSource).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  })
})
