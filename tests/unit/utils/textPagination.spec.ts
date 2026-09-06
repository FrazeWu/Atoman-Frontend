import { describe, expect, it } from 'vitest'

import { paginateText } from '@/utils/textPagination'

describe('paginateText', () => {
  it('在可用空间边界处优先按段落拆分，并保留文本偏移', () => {
    const text = '第一段内容。\n\n第二段内容。\n\n第三段内容。'
    const pages = paginateText(text, (content) => content.length <= 12)

    expect(pages).toEqual([
      { content: '第一段内容。\n\n', start: 0, end: 8 },
      { content: '第二段内容。\n\n', start: 8, end: 16 },
      { content: '第三段内容。', start: 16, end: text.length },
    ])
  })

  it('没有测量容器时按稳定的回退长度生成页面', () => {
    const pages = paginateText('abcdefghij', undefined, 4)

    expect(pages).toEqual([
      { content: 'abcd', start: 0, end: 4 },
      { content: 'efgh', start: 4, end: 8 },
      { content: 'ij', start: 8, end: 10 },
    ])
  })
})
