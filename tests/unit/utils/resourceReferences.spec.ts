import { describe, expect, it } from 'vitest'

import { parseResourceReferences, resourceKinds } from '@/utils/resourceReferences'

const DEBATE_ID = '01900000-0000-7000-8000-000000000001'
const ALBUM_ID = '01900000-0000-7000-8000-000000000002'

describe('resourceReferences', () => {
  it('定义全站可引用的 17 类资源', () => {
    expect(resourceKinds).toEqual([
      'post', 'thread', 'debate', 'feed', 'article', 'artist', 'album', 'song',
      'playlist', 'podcast', 'episode', 'video', 'person', 'event', 'channel',
      'collection', 'comment',
    ])
  })

  it('忽略用户提及并解析带关系的辩题引用', () => {
    const raw = `@debate:${DEBATE_ID}:support`
    const content = `由 @alice 补充，参考 ${raw}。`

    expect(parseResourceReferences(content)).toEqual([{
      raw,
      kind: 'debate',
      id: DEBATE_ID,
      qualifier: 'support',
      from: content.indexOf(raw),
      to: content.indexOf(raw) + raw.length,
    }])
  })

  it('解析不带 qualifier 的普通资源引用', () => {
    const raw = `@album:${ALBUM_ID}`

    expect(parseResourceReferences(raw)).toEqual([{
      raw,
      kind: 'album',
      id: ALBUM_ID,
      qualifier: '',
      from: 0,
      to: raw.length,
    }])
  })

  it('忽略未知类型、无效 UUID、非法 qualifier 和尾随冒号', () => {
    const invalidReferences = [
      `@topic:${DEBATE_ID}`,
      '@album:not-a-uuid',
      `@debate:${DEBATE_ID}`,
      `@debate:${DEBATE_ID}:neutral`,
      `@album:${ALBUM_ID}:support`,
      `@album:${ALBUM_ID}:`,
      `@debate:${DEBATE_ID}:support:extra`,
    ]

    expect(parseResourceReferences(invalidReferences.join(' '))).toEqual([])
  })

  it('在 Unicode 正文和标点中保留重复引用的准确位置', () => {
    const raw = `@debate:${DEBATE_ID}:oppose`
    const content = `证据🙂：${raw}；再次引用（${raw}）。`
    const first = content.indexOf(raw)
    const second = content.indexOf(raw, first + raw.length)

    expect(parseResourceReferences(content)).toEqual([
      expect.objectContaining({ raw, from: first, to: first + raw.length }),
      expect.objectContaining({ raw, from: second, to: second + raw.length }),
    ])
  })

  it('只解析 Markdown 正文而跳过代码、链接地址和原始 HTML', () => {
    const raw = `@album:${ALBUM_ID}`
    const link = `[显示 ${raw}](https://example/${raw})`
    const inlineHtml = `<a href="/${raw}">正文 ${raw}</a>`
    const content = [
      `普通正文 ${raw}`,
      `\`${raw}\``,
      `\`\`\`md\n${raw}\n\`\`\``,
      `    ${raw}`,
      link,
      `<https://example/${raw}>`,
      inlineHtml,
      `<div>\n${raw}\n</div>`,
    ].join('\n\n')
    const proseStart = content.indexOf(raw)
    const linkTextStart = content.indexOf(`[显示 ${raw}]`) + '[显示 '.length
    const htmlTextStart = content.indexOf(`>正文 ${raw}</a>`) + '>正文 '.length

    expect(parseResourceReferences(content)).toEqual([
      expect.objectContaining({ raw, from: proseStart, to: proseStart + raw.length }),
      expect.objectContaining({ raw, from: linkTextStart, to: linkTextStart + raw.length }),
      expect.objectContaining({ raw, from: htmlTextStart, to: htmlTextStart + raw.length }),
    ])
  })

  it('要求资源标记两侧具有 Unicode 文本边界', () => {
    const raw = `@album:${ALBUM_ID}`
    const invalid = [
      `foo${raw}`,
      `@${raw}`,
      `中${raw}`,
      `1${raw}`,
      `_${raw}`,
      `-${raw}`,
      `${raw}中文`,
      `${raw}word`,
      `${raw}1`,
      `${raw}_suffix`,
      `${raw}-suffix`,
    ].join(' ')

    expect(parseResourceReferences(invalid)).toEqual([])
    expect(parseResourceReferences(`合法 ${raw}，再次 ${raw}。`)).toHaveLength(2)
  })
})
