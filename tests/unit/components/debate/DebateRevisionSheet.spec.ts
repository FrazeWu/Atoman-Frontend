import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DebateRevision, DebateRevisionDiff } from '@/types'
import DebateRevisionSheet from '@/components/debate/DebateRevisionSheet.vue'

const mocks = vi.hoisted(() => ({
  fetchRevisions: vi.fn(),
  fetchRevisionDiff: vi.fn(),
  revertRevision: vi.fn(),
}))

vi.mock('@/stores/debate', () => ({
  useDebateStore: () => ({
    revisionsLoading: false,
    fetchRevisions: mocks.fetchRevisions,
    fetchRevisionDiff: mocks.fetchRevisionDiff,
    revertRevision: mocks.revertRevision,
  }),
}))

const buildRevision = (overrides: Partial<DebateRevision> = {}): DebateRevision => ({
  id: 'revision-1',
  version_number: 1,
  editor_id: 'editor-1',
  editor: { username: 'editor-one', display_name: '编辑者一' } as DebateRevision['editor'],
  edit_summary: '创建辩题',
  edit_type: 'creation',
  status: 'approved',
  is_current: false,
  created_at: '2026-07-01T08:00:00Z',
  snapshot: {
    title: '旧标题',
    description: '旧说明',
    content: '旧正文',
    tags: ['旧标签'],
  },
  ...overrides,
})

const revisions = [
  buildRevision(),
  buildRevision({
    id: 'revision-2',
    version_number: 2,
    previous_revision_id: 'revision-1',
    edit_summary: '补充数据',
    is_current: true,
    created_at: '2026-07-02T08:00:00Z',
  }),
]

const mountSheet = () => mount(DebateRevisionSheet, {
  props: {
    show: true,
    debateId: 'debate-1',
    currentRevisionId: 'revision-2',
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

describe('DebateRevisionSheet', () => {
  beforeEach(() => {
    mocks.fetchRevisions.mockReset().mockResolvedValue(revisions)
    mocks.fetchRevisionDiff.mockReset()
    mocks.revertRevision.mockReset()
  })

  it('展示版本信息并比较两个版本的四个字段', async () => {
    const diff: DebateRevisionDiff = {
      revision_id: 'revision-2',
      against_revision_id: 'revision-1',
      changes: {
        title: { before: '旧标题', after: '新标题', changed: true },
        description: { before: '旧说明', after: '新说明', changed: true },
        content: { before: '旧正文', after: '新正文', changed: true },
        tags: { before: ['旧标签'], after: ['新标签'], changed: true },
      },
    }
    mocks.fetchRevisionDiff.mockResolvedValue(diff)

    const wrapper = mountSheet()
    await flushPromises()

    expect(mocks.fetchRevisions).toHaveBeenCalledWith('debate-1')
    expect(wrapper.text()).toContain('v1')
    expect(wrapper.text()).toContain('编辑者一')
    expect(wrapper.text()).toContain('创建辩题')
    expect(wrapper.text()).toContain('补充数据')

    await wrapper.get('[data-test="revision-select-base-revision-1"]').trigger('click')
    await wrapper.get('[data-test="revision-select-target-revision-2"]').trigger('click')
    await flushPromises()

    expect(mocks.fetchRevisionDiff).toHaveBeenCalledWith('debate-1', 'revision-2', 'revision-1')
    expect(wrapper.get('[data-test="revision-diff-title"]').text()).toContain('旧标题')
    expect(wrapper.get('[data-test="revision-diff-title"]').text()).toContain('新标题')
    expect(wrapper.get('[data-test="revision-diff-description"]').text()).toContain('旧说明')
    expect(wrapper.get('[data-test="revision-diff-content"]').text()).toContain('新正文')
    expect(wrapper.get('[data-test="revision-diff-tags"]').text()).toContain('旧标签')
    expect(wrapper.get('[data-test="revision-diff-tags"]').text()).toContain('新标签')
  })

  it('填写摘要后使用当前基础版本回退', async () => {
    mocks.revertRevision.mockResolvedValue({ id: 'debate-1' })

    const wrapper = mountSheet()
    await flushPromises()

    expect(wrapper.get('[data-test="revert-revision-revision-1"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-test="revert-summary"]').setValue('恢复完整论证')
    await wrapper.get('[data-test="revert-revision-revision-1"]').trigger('click')
    await flushPromises()

    expect(mocks.revertRevision).toHaveBeenCalledWith('debate-1', 'revision-1', {
      base_revision: 'revision-2',
      edit_summary: '恢复完整论证',
    })
    expect(wrapper.emitted('reverted')?.[0]?.[0]).toEqual({ id: 'debate-1' })
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
