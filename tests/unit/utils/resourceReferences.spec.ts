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
})
