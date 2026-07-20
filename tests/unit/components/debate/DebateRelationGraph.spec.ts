import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DebateRelationGraph from '@/components/debate/DebateRelationGraph.vue'
import type { DebateGraph } from '@/types'

const graph: DebateGraph = {
  root_id: 'root',
  nodes: [{
    id: 'root',
    user_id: 'user-1',
    title: '长期吸烟会不会显著增加肺癌风险？',
    description: '',
    content: '',
    status: 'active',
    tags: [],
    view_count: 0,
    current_revision_id: 'revision-root',
    references: [],
    created_at: '2026-07-18T00:00:00Z',
    updated_at: '2026-07-18T00:00:00Z',
  }],
  relations: [],
  expandable_node_ids: ['root'],
}

describe('DebateRelationGraph', () => {
  it('builds the requested view and forwards node expansion', async () => {
    const wrapper = mount(DebateRelationGraph, {
      props: {
        graph,
        view: 'tree',
        expandingNodeIds: ['root'],
      },
      global: {
        stubs: {
          Background: true,
          Controls: true,
          VueFlow: {
            name: 'VueFlow',
            props: ['nodes', 'edges'],
            template: '<div><slot name="node-debate" :data="nodes[0].data" /></div>',
          },
          DebateGraphNode: {
            name: 'DebateGraphNode',
            props: ['data'],
            emits: ['expand'],
            template: '<button data-test="node-expand" @click="$emit(\'expand\', data.debate.id)">继续展开</button>',
          },
        },
      },
    })

    expect(wrapper.get('[aria-label="辩论树画布"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'VueFlow' }).props('nodes')[0].data).toMatchObject({
      expandable: true,
      expanding: true,
    })

    await wrapper.get('[data-test="node-expand"]').trigger('click')
    expect(wrapper.emitted('expand')).toEqual([['root']])
  })

  it('shows a retryable error state instead of the empty state', async () => {
    const wrapper = mount(DebateRelationGraph, {
      props: {
        graph: null,
        view: 'graph',
        error: true,
      },
    })

    expect(wrapper.text()).toContain('关系加载失败')
    expect(wrapper.text()).not.toContain('暂无引用')

    await wrapper.get('button[aria-label="重试加载关系"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
