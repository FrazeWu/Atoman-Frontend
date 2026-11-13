import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PHighlightText from '@/components/ui/PHighlightText.vue'
import { highlightSegments } from '@/utils/textHighlight'

describe('textHighlight utility', () => {
  it('returns single unhighlighted segment when query is empty', () => {
    expect(highlightSegments('百年孤独', '')).toEqual([{ text: '百年孤独', match: false }])
    expect(highlightSegments('百年孤独', '   ')).toEqual([{ text: '百年孤独', match: false }])
  })

  it('correctly segments single keyword match', () => {
    const segments = highlightSegments('多年以后，面对行刑队，奥雷里亚诺', '面对')
    expect(segments).toEqual([
      { text: '多年以后，', match: false },
      { text: '面对', match: true },
      { text: '行刑队，奥雷里亚诺', match: false },
    ])
  })

  it('supports multi-keyword splitting and case insensitivity', () => {
    const segments = highlightSegments('The Old Man and the Sea', 'the sea')
    expect(segments).toEqual([
      { text: 'The', match: true },
      { text: ' Old Man and ', match: false },
      { text: 'the', match: true },
      { text: ' ', match: false },
      { text: 'Sea', match: true },
    ])
  })
})

describe('PHighlightText component', () => {
  it('renders raw text when query is empty', () => {
    const wrapper = mount(PHighlightText, {
      props: { text: '红楼梦', query: '' },
    })
    expect(wrapper.text()).toBe('红楼梦')
    expect(wrapper.find('mark').exists()).toBe(false)
  })

  it('renders mark tags for matching query', () => {
    const wrapper = mount(PHighlightText, {
      props: { text: '红楼梦与水浒传', query: '水浒' },
    })
    const mark = wrapper.find('mark')
    expect(mark.exists()).toBe(true)
    expect(mark.text()).toBe('水浒')
    expect(mark.classes()).toContain('p-highlight-match')
  })
})
