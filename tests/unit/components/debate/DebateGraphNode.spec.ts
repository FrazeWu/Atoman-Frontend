import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DebateGraphNode from '@/components/debate/DebateGraphNode.vue'
import type { Debate } from '@/types'

const baseDebate: Debate = {
  id: 'node-1',
  user_id: 'user-1',
  title: '吸烟量越大，肺癌风险会不会越高？',
  description: '',
  content: '',
  status: 'active',
  tags: [],
  view_count: 0,
  current_revision_id: 'revision-node-1',
  references: [],
  conclusion_type: 'yes',
  created_at: '2026-07-18T00:00:00Z',
  updated_at: '2026-07-18T00:00:00Z',
}

const mountNode = (overrides: { expandable?: boolean; expanding?: boolean } = {}) => {
  const wrapper = mount(DebateGraphNode, {
    props: {
      data: {
        debate: baseDebate,
        root: false,
        expandable: overrides.expandable ?? false,
        expanding: overrides.expanding ?? false,
      },
    },
    global: {
      stubs: {
        Handle: true,
        RouterLink: {
          emits: ['click'],
          template: '<a @click="$emit(\'click\')"><slot /></a>',
        },
      },
    },
  })
  return wrapper
}

describe('DebateGraphNode', () => {
  it('uses the same yes/no conclusion wording for every debate node', () => {
    const wrapper = mountNode()

    expect(wrapper.text()).toContain('结论 · 是')
    expect(wrapper.text()).not.toContain('正向结论')
    expect(wrapper.text()).not.toContain('论点')
  })

  it('emits expand from an accessible control without activating the topic link', async () => {
    const wrapper = mountNode({ expandable: true })
    const button = wrapper.get('button[aria-label="继续展开"]')

    await button.trigger('click')

    expect(wrapper.emitted('expand')).toEqual([['node-1']])
    expect(button.element.closest('a')).toBeNull()
  })

  it('keeps the expand control in place and marks it busy while loading', () => {
    const wrapper = mountNode({ expandable: true, expanding: true })
    const button = wrapper.get('button[aria-label="继续展开"]')

    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.text()).toContain('展开中')
  })
})
