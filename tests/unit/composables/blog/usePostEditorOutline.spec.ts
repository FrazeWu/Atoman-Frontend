import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, watch } from 'vue'
import { mount } from '@vue/test-utils'
import {
  extractMarkdownHeadings,
  usePostEditorOutline,
} from '@/composables/blog/usePostEditorOutline'

describe('usePostEditorOutline', () => {
  it('从 Markdown 中准确提取各级标题、文本与行号', () => {
    const md = [
      '# 一级标题',
      '正文段落第一行',
      '## 二级章节标题 ##',
      '',
      '### 三级小节',
      '#### 细节条款',
    ].join('\n')

    const headings = extractMarkdownHeadings(md)

    expect(headings).toHaveLength(4)
    expect(headings[0]).toMatchObject({
      level: 1,
      text: '一级标题',
      lineNumber: 1,
    })
    expect(headings[1]).toMatchObject({
      level: 2,
      text: '二级章节标题',
      lineNumber: 3,
    })
    expect(headings[2]).toMatchObject({
      level: 3,
      text: '三级小节',
      lineNumber: 5,
    })
    expect(headings[3]).toMatchObject({
      level: 4,
      text: '细节条款',
      lineNumber: 6,
    })
  })

  it('忽略代码块内部的 # 注释与空内容', () => {
    const md = [
      '# 正常标题',
      '```python',
      '# this is python comment',
      'def foo(): pass',
      '```',
      '## 代码块后的标题',
    ].join('\n')

    const headings = extractMarkdownHeadings(md)

    expect(headings).toHaveLength(2)
    expect(headings[0].text).toBe('正常标题')
    expect(headings[1].text).toBe('代码块后的标题')
    expect(headings[1].lineNumber).toBe(6)
  })

  it('内容变化时通过防抖响应式更新大纲列表', async () => {
    vi.useFakeTimers()
    const content = ref('# 初始标题')
    const { headings } = usePostEditorOutline(content)

    expect(headings.value).toHaveLength(1)
    expect(headings.value[0].text).toBe('初始标题')

    content.value = '# 初始标题\n\n## 新增第二节'
    await nextTick()
    expect(headings.value).toHaveLength(1) // 尚未触发防抖

    vi.advanceTimersByTime(200)
    expect(headings.value).toHaveLength(2)
    expect(headings.value[1].text).toBe('新增第二节')

    vi.useRealTimers()
  })

  it('组件卸载后不再应用防抖更新', async () => {
    vi.useFakeTimers()
    const content = ref('# 初始标题')
    const lengths: number[] = []
    const wrapper = mount(defineComponent({
      setup() {
        const { headings } = usePostEditorOutline(content)
        watch(headings, (value) => {
          lengths.push(value.length)
        })
        return () => h('div')
      },
    }))

    content.value = '# 初始标题\n\n## 新增第二节'
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(200)

    expect(lengths).toEqual([])
    vi.useRealTimers()
  })
})
