import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DebateTopicView from '@/views/debate/DebateTopicView.vue'
import { useAuthStore } from '@/stores/auth'
import type { Debate, DebateGraph, DebateRelation, DebateVoteSummary } from '@/types'

const routerPush = vi.hoisted(() => vi.fn())
let store: ReturnType<typeof buildStore>
let currentRoute: { params: { id: string } }

vi.mock('vue-router', () => ({
  useRoute: () => currentRoute,
  useRouter: () => ({ push: routerPush }),
  RouterLink: { template: '<a><slot /></a>' },
}))

vi.mock('@/stores/debate', () => ({
  useDebateStore: () => store,
}))

const staleID = '11111111-1111-4111-8111-111111111111'
const unavailableID = '22222222-2222-4222-8222-222222222222'

const root: Debate = {
  id: 'root',
  user_id: 'user-1',
  title: '长期吸烟会不会显著增加肺癌风险？',
  description: '汇总流行病学证据。',
  content: `现有证据支持 @debate:${staleID}:support，原始数据见 @post:${unavailableID}。`,
  status: 'active',
  tags: ['医学'],
  view_count: 0,
  current_revision_id: 'revision-current',
  current_conclusion_event_id: 'conclusion-current',
  conclusion_type: 'yes',
  references: [
    {
      raw: `@debate:${staleID}:support`,
      kind: 'debate',
      resource_id: staleID,
      title: '吸烟显著增加肺癌风险',
      qualifier: 'support',
      state: 'stale',
      relation_id: 'relation-stale',
    },
    {
      raw: `@post:${unavailableID}`,
      kind: 'post',
      resource_id: unavailableID,
      title: '队列研究原始数据',
      state: 'unavailable',
      relation_id: 'relation-unavailable',
    },
  ],
  created_at: '2026-07-18T00:00:00Z',
  updated_at: '2026-07-19T00:00:00Z',
}

const votes: DebateVoteSummary = {
  yes_votes: 32,
  no_votes: 9,
  total_votes: 41,
  current_direction: 'yes',
  current_user_vote: 'yes',
}

const graph: DebateGraph = {
  root_id: 'root',
  nodes: [root],
  relations: [],
  expandable_node_ids: [],
}

const supportOne: Debate = {
  ...root,
  id: 'support-1',
  title: '烟草烟雾会不会含有已知致癌物？',
  content: '',
  current_revision_id: 'revision-support-1',
  current_conclusion_event_id: 'conclusion-support-1',
  references: [],
}

const supportTwo: Debate = {
  ...root,
  id: 'support-2',
  title: '过滤嘴会不会去除全部致癌物？',
  content: '',
  current_revision_id: 'revision-support-2',
  current_conclusion_event_id: 'conclusion-support-2',
  references: [],
}

const supportLeaf: Debate = {
  ...root,
  id: 'support-leaf',
  title: '焦油中会不会检测到多环芳烃？',
  content: '',
  current_revision_id: 'revision-support-leaf',
  current_conclusion_event_id: 'conclusion-support-leaf',
  references: [],
}

function relation(id: string, source: string, target: string): DebateRelation {
  return {
    id,
    source_debate_id: source,
    target_debate_id: target,
    stance: 'support',
    target_revision_id: `revision-${target}`,
    source_conclusion_event_id: `conclusion-${source}`,
    status: 'active',
    created_at: '2026-07-18T00:00:00Z',
    updated_at: '2026-07-18T00:00:00Z',
  }
}

const expandableTree: DebateGraph = {
  root_id: 'root',
  nodes: [root, supportOne],
  relations: [relation('relation-root-support-1', 'support-1', 'root')],
  expandable_node_ids: ['support-1'],
}

const supportFragment: DebateGraph = {
  root_id: 'support-1',
  nodes: [supportOne, root, supportLeaf],
  relations: [
    relation('relation-root-support-1', 'support-1', 'root'),
    relation('relation-support-1-leaf', 'support-leaf', 'support-1'),
  ],
  expandable_node_ids: ['support-1', 'support-leaf'],
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>(nextResolve => { resolve = nextResolve })
  return { promise, resolve }
}

function buildStore() {
  return reactive({
    currentDebate: root as Debate | null,
    voteSummary: votes as DebateVoteSummary | null,
    relationGraph: graph as DebateGraph | null,
    loading: false,
    votesLoading: false,
    relationLoading: false,
    fetchDebate: vi.fn().mockResolvedValue(root),
    fetchVotes: vi.fn().mockResolvedValue(votes),
    setVote: vi.fn().mockResolvedValue(votes),
    removeVote: vi.fn().mockResolvedValue(votes),
    fetchRelationGraph: vi.fn().mockResolvedValue(graph),
    fetchRevisions: vi.fn().mockResolvedValue([]),
    reconfirmReference: vi.fn().mockResolvedValue(root),
  })
}

function mountView() {
  return shallowMount(DebateTopicView, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        PButton: {
          props: ['disabled', 'loading'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        },
        DebateVotePanel: true,
        DebateRelationGraph: {
          name: 'DebateRelationGraph',
          props: ['graph', 'loading', 'view', 'expandingNodeIds'],
          emits: ['expand'],
          template: '<div />',
        },
        DebateWikiEditor: true,
        DebateRevisionSheet: true,
        DebateDiscussionSheet: true,
      },
    },
  })
}

describe('DebateTopicView relation experience', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    authStore.user = { uuid: 'user-1', username: 'fafa' } as never
    routerPush.mockReset()
    document.body.innerHTML = ''
    currentRoute = reactive({ params: { id: 'root' } })
    store = buildStore()
  })

  it('使用正文、辩论树和关系图三个主标签，且只保留三个页面动作', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findAll('[role="tab"]').map(item => item.text())).toEqual(['正文', '辩论树', '关系图'])
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('正文')
    expect(wrapper.find('[data-test="direct-relation-action"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-test^="topic-action-"]').map(item => item.text().trim())).toEqual([
      '编辑',
      '版本',
      '讨论',
    ])
    expect(wrapper.text()).not.toContain('结题')
    expect(wrapper.text()).not.toContain('重开')
    expect(wrapper.text()).not.toContain('申请结题')
    expect(store.fetchDebate).toHaveBeenCalledWith('root')
    expect(store.fetchVotes).toHaveBeenCalledWith('root')
    expect(store.fetchRelationGraph).not.toHaveBeenCalled()
  })

  it('切换关系视图时使用对应深度', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await flushPromises()
    expect(store.fetchRelationGraph).toHaveBeenLastCalledWith('root', 'tree', 3)

    await wrapper.findAll('[role="tab"]')[2]!.trigger('click')
    await flushPromises()
    expect(store.fetchRelationGraph).toHaveBeenLastCalledWith('root', 'graph', 2)
  })

  it('按 depth 1 展开节点并按 ID 合并，同时保留初始根和重置基础图', async () => {
    const expansion = deferred<DebateGraph>()
    store.fetchRelationGraph.mockImplementation(async (id: string) => {
      if (id === 'root') return expandableTree
      return expansion.promise
    })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await flushPromises()
    let relationView = wrapper.findComponent({ name: 'DebateRelationGraph' })
    expect(relationView.props('graph')).toEqual(expandableTree)
    expect(relationView.props('view')).toBe('tree')

    relationView.vm.$emit('expand', 'support-1')
    await nextTick()

    expect(store.fetchRelationGraph).toHaveBeenLastCalledWith('support-1', 'tree', 1)
    expect(relationView.props('expandingNodeIds')).toEqual(['support-1'])

    expansion.resolve(supportFragment)
    await flushPromises()

    relationView = wrapper.findComponent({ name: 'DebateRelationGraph' })
    const merged = relationView.props('graph') as DebateGraph
    expect(merged.root_id).toBe('root')
    expect(merged.nodes.map(node => node.id)).toEqual(['root', 'support-1', 'support-leaf'])
    expect(merged.relations.map(item => item.id)).toEqual([
      'relation-root-support-1',
      'relation-support-1-leaf',
    ])
    expect(merged.expandable_node_ids).toEqual(['support-leaf'])
    expect(relationView.props('expandingNodeIds')).toEqual([])
    expect(store.relationGraph?.root_id).toBe('root')

    await wrapper.findAll('[role="tab"]')[0]!.trigger('click')
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await flushPromises()

    const reloaded = wrapper.findComponent({ name: 'DebateRelationGraph' }).props('graph') as DebateGraph
    expect(reloaded.nodes.map(node => node.id)).toEqual(['root', 'support-1'])
    expect(reloaded.expandable_node_ids).toEqual(['support-1'])
  })

  it('并发展开按节点维护状态，逆序返回也会合并到同一个根图', async () => {
    const first = deferred<DebateGraph>()
    const second = deferred<DebateGraph>()
    const base: DebateGraph = {
      root_id: 'root',
      nodes: [root, supportOne, supportTwo],
      relations: [
        relation('relation-root-support-1', 'support-1', 'root'),
        relation('relation-root-support-2', 'support-2', 'root'),
      ],
      expandable_node_ids: ['support-1', 'support-2'],
    }
    const secondLeaf: Debate = {
      ...supportLeaf,
      id: 'support-leaf-2',
      current_revision_id: 'revision-support-leaf-2',
    }
    store.fetchRelationGraph.mockImplementation(async (id: string) => {
      if (id === 'root') return base
      if (id === 'support-1') return first.promise
      return second.promise
    })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await flushPromises()
    let relationView = wrapper.findComponent({ name: 'DebateRelationGraph' })

    relationView.vm.$emit('expand', 'support-1')
    relationView.vm.$emit('expand', 'support-2')
    await nextTick()
    expect(relationView.props('expandingNodeIds')).toEqual(['support-1', 'support-2'])

    second.resolve({
      root_id: 'support-2',
      nodes: [supportTwo, secondLeaf],
      relations: [relation('relation-support-2-leaf', 'support-leaf-2', 'support-2')],
      expandable_node_ids: [],
    })
    await flushPromises()
    first.resolve(supportFragment)
    await flushPromises()

    relationView = wrapper.findComponent({ name: 'DebateRelationGraph' })
    const merged = relationView.props('graph') as DebateGraph
    expect(merged.root_id).toBe('root')
    expect(merged.nodes.map(node => node.id)).toEqual([
      'root',
      'support-1',
      'support-2',
      'support-leaf-2',
      'support-leaf',
    ])
    expect(relationView.props('expandingNodeIds')).toEqual([])
  })

  it('切换关系标签后丢弃仍在返回的旧视图展开结果', async () => {
    const staleExpansion = deferred<DebateGraph>()
    const graphView: DebateGraph = {
      root_id: 'root',
      nodes: [root, supportTwo],
      relations: [relation('relation-root-support-2', 'support-2', 'root')],
      expandable_node_ids: [],
    }
    store.fetchRelationGraph.mockImplementation(async (id: string, view: string) => {
      if (id === 'support-1') return staleExpansion.promise
      return view === 'tree' ? expandableTree : graphView
    })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await flushPromises()
    wrapper.findComponent({ name: 'DebateRelationGraph' }).vm.$emit('expand', 'support-1')

    await wrapper.findAll('[role="tab"]')[2]!.trigger('click')
    await flushPromises()
    staleExpansion.resolve(supportFragment)
    await flushPromises()

    const current = wrapper.findComponent({ name: 'DebateRelationGraph' })
    expect(current.props('view')).toBe('graph')
    expect((current.props('graph') as DebateGraph).nodes.map(node => node.id)).toEqual(['root', 'support-2'])
    expect((current.props('graph') as DebateGraph).root_id).toBe('root')
  })

  it('切换路由后丢弃旧辩题的展开结果', async () => {
    const staleExpansion = deferred<DebateGraph>()
    const nextDebate: Debate = {
      ...root,
      id: 'topic-b',
      title: '规律运动会不会降低心血管疾病风险？',
      current_revision_id: 'revision-topic-b',
      references: [],
    }
    const nextGraph: DebateGraph = {
      root_id: 'topic-b',
      nodes: [nextDebate],
      relations: [],
      expandable_node_ids: [],
    }
    store.fetchDebate.mockImplementation(async (id: string) => {
      const result = id === 'root' ? root : nextDebate
      store.currentDebate = result
      return result
    })
    store.fetchVotes.mockImplementation(async () => votes)
    store.fetchRelationGraph.mockImplementation(async (id: string) => {
      if (id === 'root') return expandableTree
      if (id === 'support-1') return staleExpansion.promise
      return nextGraph
    })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await flushPromises()
    wrapper.findComponent({ name: 'DebateRelationGraph' }).vm.$emit('expand', 'support-1')

    currentRoute.params.id = 'topic-b'
    await flushPromises()
    staleExpansion.resolve(supportFragment)
    await flushPromises()
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await flushPromises()

    const current = wrapper.findComponent({ name: 'DebateRelationGraph' })
    expect((current.props('graph') as DebateGraph).root_id).toBe('topic-b')
    expect((current.props('graph') as DebateGraph).nodes.map(node => node.id)).toEqual(['topic-b'])
  })

  it('区分变化和不可用引用，且只允许重新确认变化引用', async () => {
    const wrapper = mountView()
    await flushPromises()

    const content = wrapper.get('[data-test="debate-content"]')
    expect(content.text()).toContain('辩题')
    expect(content.text()).toContain('吸烟显著增加肺癌风险')
    expect(content.text()).toContain('支撑')
    expect(content.text()).toContain('来源结论已变化')
    expect(content.text()).toContain('队列研究原始数据')
    expect(content.text()).toContain('不可用')
    expect(content.findAll('[data-reconfirm-reference]')).toHaveLength(1)
    expect(content.find('[data-reference-state="unavailable"] [data-reconfirm-reference]').exists()).toBe(false)
  })

  it('忽略作者 HTML 伪造的重新确认按钮，只接受受控引用按钮', async () => {
    const forgedDebate: Debate = {
      ...root,
      content: [
        '<button type="button" data-test="forged-reconfirm" data-reconfirm-reference="relation-stale">伪造确认</button>',
        root.content,
      ].join('\n\n'),
    }
    store.currentDebate = forgedDebate
    store.fetchDebate.mockResolvedValue(forgedDebate)
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-test="forged-reconfirm"]').trigger('click')
    await flushPromises()
    expect(store.reconfirmReference).not.toHaveBeenCalled()

    await wrapper.get('[data-reconfirm-reference="relation-stale"]').trigger('click')
    await flushPromises()
    expect(store.reconfirmReference).toHaveBeenCalledTimes(1)
  })

  it('重新确认引用后刷新正文和此前加载的关系视图', async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await flushPromises()
    await wrapper.findAll('[role="tab"]')[0]!.trigger('click')

    await wrapper.get('[data-reconfirm-reference="relation-stale"]').trigger('click')
    await flushPromises()

    expect(store.reconfirmReference).toHaveBeenCalledWith('root', 'relation-stale', {
      base_revision: 'revision-current',
      edit_summary: '重新确认引用',
    })
    expect(store.fetchDebate).toHaveBeenCalledTimes(2)
    expect(store.fetchRelationGraph).toHaveBeenLastCalledWith('root', 'tree', 3)
  })

  it('切换路由后立即隔离旧辩题和投票，直到新辩题完整加载', async () => {
    const nextDebateRequest = deferred<Debate>()
    const nextVotesRequest = deferred<DebateVoteSummary>()
    const nextDebate: Debate = {
      ...root,
      id: 'topic-b',
      user_id: 'user-2',
      title: '规律运动会不会降低心血管疾病风险？',
      content: '新辩题正文',
      current_revision_id: 'revision-b',
      references: [],
    }
    const nextVotes: DebateVoteSummary = {
      yes_votes: 8,
      no_votes: 4,
      total_votes: 12,
      current_direction: '',
      current_user_vote: 'no',
    }
    store.fetchDebate.mockImplementation(async (id: string) => {
      if (id === 'root') return root
      const result = await nextDebateRequest.promise
      store.currentDebate = result
      return result
    })
    store.fetchVotes.mockImplementation(async (id: string) => {
      if (id === 'root') return votes
      const result = await nextVotesRequest.promise
      store.voteSummary = result
      return result
    })

    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain(root.title)
    await wrapper.get('[data-test="topic-action-revisions"]').trigger('click')

    currentRoute.params.id = 'topic-b'
    await nextTick()

    expect(wrapper.text()).toContain('加载中...')
    expect(wrapper.text()).not.toContain(root.title)
    expect(wrapper.text()).not.toContain(root.content)
    expect(wrapper.find('[data-test^="topic-action-"]').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'DebateVotePanel' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'DebateRevisionSheet' }).exists()).toBe(false)

    nextDebateRequest.resolve(nextDebate)
    await flushPromises()

    expect(wrapper.text()).toContain(nextDebate.title)
    expect(wrapper.text()).toContain(nextDebate.content)
    expect(wrapper.findComponent({ name: 'DebateVotePanel' }).props('loading')).toBe(true)
    expect(wrapper.findComponent({ name: 'DebateVotePanel' }).props('summary')).toBeNull()

    nextVotesRequest.resolve(nextVotes)
    await flushPromises()

    expect(wrapper.text()).toContain(nextDebate.title)
    expect(wrapper.text()).toContain(nextDebate.content)
    expect(wrapper.text()).not.toContain(root.title)
    expect(wrapper.findComponent({ name: 'DebateVotePanel' }).props('summary')).toEqual(nextVotes)
  })

  it('切换路由会隔离悬挂的重新确认，并在当前请求失败后刷新版本再重试', async () => {
    const oldRequest = deferred<Debate | null>()
    const nextReferenceID = '33333333-3333-4333-8333-333333333333'
    const nextDebate: Debate = {
      ...root,
      id: 'topic-b',
      title: '规律运动会不会降低心血管疾病风险？',
      content: `新证据 @debate:${nextReferenceID}:support`,
      current_revision_id: 'revision-b1',
      references: [{
        raw: `@debate:${nextReferenceID}:support`,
        kind: 'debate',
        resource_id: nextReferenceID,
        title: '规律运动降低心血管风险',
        qualifier: 'support',
        state: 'stale',
        relation_id: 'relation-b',
      }],
    }
    const refreshedDebate = { ...nextDebate, current_revision_id: 'revision-b2' }
    let nextFetchCount = 0
    let nextReconfirmCount = 0
    store.fetchDebate.mockImplementation(async (id: string) => {
      if (id === 'root') return root
      nextFetchCount += 1
      const result = nextFetchCount === 1 ? nextDebate : refreshedDebate
      store.currentDebate = result
      return result
    })
    store.fetchVotes.mockImplementation(async (id: string) => {
      const result = id === 'root' ? votes : { ...votes, current_user_vote: '' as const }
      store.voteSummary = result
      return result
    })
    store.reconfirmReference.mockImplementation(async (_id: string, relationID: string) => {
      if (relationID === 'relation-stale') return oldRequest.promise
      nextReconfirmCount += 1
      return nextReconfirmCount === 1 ? null : refreshedDebate
    })

    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('[data-reconfirm-reference="relation-stale"]').trigger('click')

    currentRoute.params.id = 'topic-b'
    await flushPromises()
    expect(wrapper.text()).toContain(nextDebate.title)

    await wrapper.get('[data-reconfirm-reference="relation-b"]').trigger('click')
    await flushPromises()

    expect(store.reconfirmReference).toHaveBeenCalledWith('topic-b', 'relation-b', {
      base_revision: 'revision-b1',
      edit_summary: '重新确认引用',
    })
    expect(wrapper.get('[data-test="reconfirm-error"]').text()).toContain('重新确认失败，请重试')
    expect(store.fetchDebate).toHaveBeenCalledWith('topic-b')

    await wrapper.get('[data-reconfirm-reference="relation-b"]').trigger('click')
    await flushPromises()
    expect(store.reconfirmReference).toHaveBeenLastCalledWith('topic-b', 'relation-b', {
      base_revision: 'revision-b2',
      edit_summary: '重新确认引用',
    })

    oldRequest.resolve(root)
    await flushPromises()
    expect(store.fetchDebate.mock.calls.filter(([id]) => id === 'root')).toHaveLength(1)
    expect(wrapper.find('[data-test="reconfirm-error"]').exists()).toBe(false)
    expect(wrapper.text()).toContain(nextDebate.title)
  })

  it('支持 tabs roving tabindex、稳定面板和方向键导航', async () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus')
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('#debate-panel-content').exists()).toBe(true)
    expect(wrapper.find('#debate-panel-tree').exists()).toBe(true)
    expect(wrapper.find('#debate-panel-graph').exists()).toBe(true)
    expect(wrapper.findAll('[role="tab"]').map(tab => tab.attributes('tabindex'))).toEqual(['0', '-1', '-1'])

    await wrapper.findAll('[role="tab"]')[0]!.trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    let tabButtons = wrapper.findAll('[role="tab"]')
    expect(tabButtons[1]!.attributes('aria-selected')).toBe('true')
    expect(focusSpy).toHaveBeenLastCalledWith()
    expect(focusSpy.mock.instances.at(-1)).toBe(tabButtons[1]!.element)

    await tabButtons[1]!.trigger('keydown', { key: 'End' })
    await flushPromises()
    tabButtons = wrapper.findAll('[role="tab"]')
    expect(tabButtons[2]!.attributes('aria-selected')).toBe('true')

    await tabButtons[2]!.trigger('keydown', { key: 'Home' })
    await flushPromises()
    tabButtons = wrapper.findAll('[role="tab"]')
    expect(tabButtons[0]!.attributes('aria-selected')).toBe('true')

    await tabButtons[0]!.trigger('keydown', { key: 'ArrowLeft' })
    await flushPromises()
    expect(wrapper.findAll('[role="tab"]')[2]!.attributes('aria-selected')).toBe('true')
    focusSpy.mockRestore()
    wrapper.unmount()
  })
})
