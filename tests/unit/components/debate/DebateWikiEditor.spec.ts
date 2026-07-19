import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Debate, DebateRevision } from '@/types'
import DebateWikiEditor from '@/components/debate/DebateWikiEditor.vue'

const mocks = vi.hoisted(() => ({
  saveWiki: vi.fn(),
  searchCitableDebates: vi.fn(),
  fetchRevision: vi.fn(),
}))

vi.mock('@/stores/debate', () => ({
  useDebateStore: () => ({
    wikiSaving: false,
    saveWiki: mocks.saveWiki,
    searchCitableDebates: mocks.searchCitableDebates,
    fetchRevision: mocks.fetchRevision,
  }),
}))

const buildDebate = (overrides: Partial<Debate> = {}): Debate => ({
  id: 'debate-root',
  user_id: 'user-1',
  title: '是否应该建设城市有轨电车？',
  description: '评估公共交通投资。',
  content: '现有正文',
  status: 'active',
  tags: ['交通', '城市'],
  view_count: 10,
  current_revision_id: 'revision-3',
  created_at: '2026-07-01T08:00:00Z',
  updated_at: '2026-07-02T08:00:00Z',
  ...overrides,
})

const buildRevision = (
  id: string,
  snapshot: DebateRevision['snapshot'],
): DebateRevision => ({
  id,
  version_number: id === 'revision-3' ? 3 : 4,
  editor_id: 'editor-1',
  edit_summary: '编辑辩题',
  edit_type: 'edit',
  status: 'approved',
  is_current: id === 'revision-4',
  created_at: '2026-07-02T08:00:00Z',
  snapshot,
})

const mountEditor = (debate = buildDebate()) => mount(DebateWikiEditor, {
  props: {
    show: true,
    debate,
    currentRevisionId: 'revision-3',
  },
  global: {
    stubs: {
      PSheet: {
        props: ['show'],
        emits: ['close'],
        template: '<section v-if="show"><slot /></section>',
      },
      PEditor: {
        props: ['modelValue'],
        emits: ['update:modelValue'],
        template: '<textarea data-test="wiki-content" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
      },
    },
  },
})

describe('DebateWikiEditor', () => {
  beforeEach(() => {
    mocks.saveWiki.mockReset()
    mocks.searchCitableDebates.mockReset()
    mocks.fetchRevision.mockReset()
  })

  it('只插入已形成结论且未归档的辩题引用', async () => {
    const citable = buildDebate({
      id: 'debate-citable',
      title: '有轨电车能降低中心城区拥堵',
      current_conclusion_event_id: 'conclusion-1',
      conclusion_type: 'yes',
    })
    const unresolved = buildDebate({ id: 'debate-unresolved', title: '尚无结论', current_conclusion_event_id: undefined })
    const archived = buildDebate({
      id: 'debate-archived',
      title: '已归档结论',
      status: 'archived',
      current_conclusion_event_id: 'conclusion-2',
      conclusion_type: 'no',
    })
    mocks.searchCitableDebates.mockResolvedValue([citable, unresolved, archived])

    const wrapper = mountEditor()
    await wrapper.get('[data-test="insert-reference"]').trigger('click')
    await wrapper.get('[data-test="reference-search"]').setValue('有轨电车')
    await flushPromises()

    expect(mocks.searchCitableDebates).toHaveBeenCalledWith('有轨电车', 'debate-root')
    expect(wrapper.find('[data-test="reference-result-debate-citable"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="reference-result-debate-unresolved"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="reference-result-debate-archived"]').exists()).toBe(false)

    await wrapper.get('[data-test="reference-result-debate-citable"]').trigger('click')
    expect(wrapper.get('[data-test="confirm-reference"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-test="reference-stance-oppose"]').trigger('click')
    await wrapper.get('[data-test="confirm-reference"]').trigger('click')

    expect(wrapper.get('[data-test="wiki-content"]').element).toHaveProperty(
      'value',
      '现有正文\n\n@debate:debate-citable:oppose',
    )
    expect(wrapper.emitted('update:content')?.at(-1)).toEqual([
      '现有正文\n\n@debate:debate-citable:oppose',
    ])
  })

  it('保存冲突时保留草稿并显示三方信息', async () => {
    mocks.saveWiki.mockResolvedValue({
      ok: false,
      conflict: {
        base_revision_id: 'revision-3',
        current_revision_id: 'revision-4',
      },
    })
    mocks.fetchRevision
      .mockResolvedValueOnce(buildRevision('revision-3', {
        title: '基础标题',
        description: '基础说明',
        content: '基础正文',
        tags: ['基础标签'],
      }))
      .mockResolvedValueOnce(buildRevision('revision-4', {
        title: '当前标题',
        description: '当前说明',
        content: '当前正文',
        tags: ['当前标签'],
      }))

    const wrapper = mountEditor()
    await wrapper.get('[data-test="wiki-title"]').setValue('新的辩题标题')
    await wrapper.get('[data-test="wiki-description"]').setValue('草稿说明')
    await wrapper.get('[data-test="wiki-content"]').setValue('尚未保存的正文')
    await wrapper.get('[data-test="wiki-tags"]').setValue('草稿标签一, 草稿标签二')
    await wrapper.get('[data-test="wiki-edit-summary"]').setValue('补充交通数据')
    await wrapper.get('[data-test="save-wiki"]').trigger('click')
    await flushPromises()

    expect(mocks.saveWiki).toHaveBeenCalledWith('debate-root', {
      title: '新的辩题标题',
      description: '草稿说明',
      content: '尚未保存的正文',
      tags: ['草稿标签一', '草稿标签二'],
      base_revision: 'revision-3',
      edit_summary: '补充交通数据',
    })
    expect(mocks.fetchRevision).toHaveBeenNthCalledWith(1, 'debate-root', 'revision-3')
    expect(mocks.fetchRevision).toHaveBeenNthCalledWith(2, 'debate-root', 'revision-4')
    expect(wrapper.get('[data-test="wiki-conflict-base"]').text()).toContain('基础标题')
    expect(wrapper.get('[data-test="wiki-conflict-base"]').text()).toContain('基础说明')
    expect(wrapper.get('[data-test="wiki-conflict-base"]').text()).toContain('基础正文')
    expect(wrapper.get('[data-test="wiki-conflict-base"]').text()).toContain('基础标签')
    expect(wrapper.get('[data-test="wiki-conflict-current"]').text()).toContain('当前标题')
    expect(wrapper.get('[data-test="wiki-conflict-current"]').text()).toContain('当前说明')
    expect(wrapper.get('[data-test="wiki-conflict-current"]').text()).toContain('当前正文')
    expect(wrapper.get('[data-test="wiki-conflict-current"]').text()).toContain('当前标签')
    expect(wrapper.get('[data-test="wiki-conflict-draft"]').text()).toContain('新的辩题标题')
    expect(wrapper.get('[data-test="wiki-conflict-draft"]').text()).toContain('草稿说明')
    expect(wrapper.get('[data-test="wiki-conflict-draft"]').text()).toContain('尚未保存的正文')
    expect(wrapper.get('[data-test="wiki-conflict-draft"]').text()).toContain('草稿标签一、草稿标签二')
    expect(wrapper.get('[data-test="wiki-content"]').element).toHaveProperty('value', '尚未保存的正文')
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()
  })
})
