import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Debate, DebateRevision } from '@/types'
import DebateWikiEditor from '@/components/debate/DebateWikiEditor.vue'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve })
  return { promise, resolve }
}

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
        props: ['modelValue', 'editorAriaLabel', 'enableResourceReferences', 'resourceReferenceLabels'],
        emits: ['update:modelValue'],
        template: '<textarea data-test="wiki-content" :data-enable-resource-references="String(enableResourceReferences)" :data-resource-reference-labels="JSON.stringify(resourceReferenceLabels)" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
      },
    },
  },
})

const mountEditorWithRealCodeMirror = async () => {
  const wrapper = mount(DebateWikiEditor, {
    props: {
      show: true,
      debate: buildDebate(),
      currentRevisionId: 'revision-3',
    },
    global: {
      stubs: {
        PSheet: {
          props: ['show'],
          emits: ['close'],
          template: '<section v-if="show"><slot /></section>',
        },
      },
    },
  })
  await vi.dynamicImportSettled()
  await nextTick()
  return wrapper
}

describe('DebateWikiEditor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
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
    expect(wrapper.get('[data-test="wiki-content-region"]').attributes('aria-labelledby')).toBeUndefined()
    expect(wrapper.get('#wiki-content-label').text()).toBe('正文')
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

  it('把正文可访问名称传给真实 CodeMirror textbox', async () => {
    const wrapper = await mountEditorWithRealCodeMirror()

    expect(wrapper.get('.cm-content[role="textbox"]').attributes('aria-label')).toBe('正文')
  })

  it('向编辑器传入正文引用的行内状态标签', () => {
    const sourceID = '11111111-1111-4111-8111-111111111111'
    const wrapper = mountEditor(buildDebate({
      content: `证据来自 @debate:${sourceID}:support`,
      references: [{
        raw: `@debate:${sourceID}:support`,
        kind: 'debate',
        resource_id: sourceID,
        title: '有轨电车能降低中心城区拥堵',
        qualifier: 'support',
        state: 'stale',
        relation_id: 'relation-1',
      }],
    }))

    const editor = wrapper.get('[data-test="wiki-content"]')
    expect(editor.attributes('data-enable-resource-references')).toBe('true')
    expect(JSON.parse(editor.attributes('data-resource-reference-labels')!)).toEqual({
      [`debate:${sourceID}`]: {
        title: '有轨电车能降低中心城区拥堵',
        qualifierLabel: '支撑',
        state: 'stale',
      },
    })
  })

  it('保存冲突时保留草稿并显示三方信息', async () => {
    mocks.saveWiki
      .mockResolvedValueOnce({
        ok: false,
        conflict: {
          base_revision_id: 'revision-3',
          current_revision_id: 'revision-4',
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        debate: buildDebate({ current_revision_id: 'revision-5' }),
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

    await wrapper.get('[data-test="save-wiki"]').trigger('click')
    await flushPromises()

    expect(mocks.saveWiki).toHaveBeenNthCalledWith(2, 'debate-root', expect.objectContaining({
      base_revision: 'revision-4',
    }))
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('保存期间继续编辑时保留新草稿并从成功版本继续保存', async () => {
    const pendingSave = deferred<{ ok: true; debate: Debate }>()
    mocks.saveWiki
      .mockReturnValueOnce(pendingSave.promise)
      .mockResolvedValueOnce({
        ok: true,
        debate: buildDebate({ current_revision_id: 'revision-5' }),
      })

    const wrapper = mountEditor()
    await wrapper.get('[data-test="wiki-edit-summary"]').setValue('第一次保存')
    await wrapper.get('[data-test="save-wiki"]').trigger('click')
    await wrapper.get('[data-test="wiki-content"]').setValue('保存期间继续修改')

    pendingSave.resolve({
      ok: true,
      debate: buildDebate({ current_revision_id: 'revision-4' }),
    })
    await flushPromises()

    expect(wrapper.get('[data-test="wiki-content"]').element).toHaveProperty('value', '保存期间继续修改')
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.get('[data-test="save-wiki"]').trigger('click')
    await flushPromises()

    expect(mocks.saveWiki).toHaveBeenNthCalledWith(2, 'debate-root', expect.objectContaining({
      content: '保存期间继续修改',
      base_revision: 'revision-4',
    }))
  })

  it('关闭重开后旧保存成功不会关闭新会话', async () => {
    const pendingSave = deferred<{ ok: true; debate: Debate }>()
    mocks.saveWiki.mockReturnValueOnce(pendingSave.promise)
    const wrapper = mountEditor()
    await wrapper.get('[data-test="wiki-edit-summary"]').setValue('旧会话保存')
    await wrapper.get('[data-test="save-wiki"]').trigger('click')

    const nextDebate = buildDebate({
      id: 'debate-next',
      title: '新的辩题',
      content: '新的正文',
      current_revision_id: 'revision-next',
    })
    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true, debate: nextDebate, currentRevisionId: 'revision-next' })

    pendingSave.resolve({
      ok: true,
      debate: buildDebate({ current_revision_id: 'revision-4' }),
    })
    await flushPromises()

    expect(wrapper.get('[data-test="wiki-title"]').element).toHaveProperty('value', '新的辩题')
    expect(wrapper.get('[data-test="wiki-content"]').element).toHaveProperty('value', '新的正文')
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('辩题切换后旧冲突不会读取新辩题的版本或覆盖草稿', async () => {
    const pendingSave = deferred<{
      ok: false
      conflict: { base_revision_id: string; current_revision_id: string }
    }>()
    mocks.saveWiki.mockReturnValueOnce(pendingSave.promise)
    const wrapper = mountEditor()
    await wrapper.get('[data-test="wiki-edit-summary"]').setValue('旧会话保存')
    await wrapper.get('[data-test="save-wiki"]').trigger('click')

    await wrapper.setProps({
      debate: buildDebate({ id: 'debate-next', title: '新的辩题', current_revision_id: 'revision-next' }),
      currentRevisionId: 'revision-next',
    })
    pendingSave.resolve({
      ok: false,
      conflict: { base_revision_id: 'revision-3', current_revision_id: 'revision-4' },
    })
    await flushPromises()

    expect(mocks.fetchRevision).not.toHaveBeenCalled()
    expect(wrapper.find('[data-test="wiki-conflict"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="wiki-title"]').element).toHaveProperty('value', '新的辩题')
  })

  it('关闭重开后旧引用搜索不会回填新会话', async () => {
    const pendingSearch = deferred<Debate[]>()
    mocks.searchCitableDebates.mockReturnValueOnce(pendingSearch.promise)
    const wrapper = mountEditor()
    await wrapper.get('[data-test="insert-reference"]').trigger('click')
    await wrapper.get('[data-test="reference-search"]').setValue('旧搜索')

    await wrapper.setProps({ show: false })
    await wrapper.setProps({
      show: true,
      debate: buildDebate({ id: 'debate-next', title: '新的辩题', current_revision_id: 'revision-next' }),
      currentRevisionId: 'revision-next',
    })
    await wrapper.get('[data-test="insert-reference"]').trigger('click')

    pendingSearch.resolve([buildDebate({
      id: 'debate-old-result',
      title: '旧搜索结果',
      current_conclusion_event_id: 'conclusion-old',
      conclusion_type: 'yes',
    })])
    await flushPromises()

    expect(wrapper.find('[data-test="reference-result-debate-old-result"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('搜索中...')
  })

  it('冲突快照加载失败后可以重试', async () => {
    mocks.saveWiki.mockResolvedValueOnce({
      ok: false,
      conflict: { base_revision_id: 'revision-3', current_revision_id: 'revision-4' },
    })
    mocks.fetchRevision
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildRevision('revision-3', {
        title: '基础标题', description: '基础说明', content: '基础正文', tags: ['基础标签'],
      }))
      .mockResolvedValueOnce(buildRevision('revision-4', {
        title: '当前标题', description: '当前说明', content: '当前正文', tags: ['当前标签'],
      }))

    const wrapper = mountEditor()
    await wrapper.get('[data-test="wiki-edit-summary"]').setValue('触发冲突')
    await wrapper.get('[data-test="save-wiki"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="wiki-conflict-snapshot-error"]').text()).toContain('版本内容加载失败')
    await wrapper.get('[data-test="retry-conflict-snapshots"]').trigger('click')
    await flushPromises()

    expect(mocks.fetchRevision).toHaveBeenNthCalledWith(3, 'debate-root', 'revision-3')
    expect(mocks.fetchRevision).toHaveBeenNthCalledWith(4, 'debate-root', 'revision-4')
    expect(wrapper.find('[data-test="wiki-conflict-snapshot-error"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="wiki-conflict-current"]').text()).toContain('当前正文')
  })
})
