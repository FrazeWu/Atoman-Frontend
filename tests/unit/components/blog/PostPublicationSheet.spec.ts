import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PostPublicationSheet from '@/components/blog/PostPublicationSheet.vue'
import PSheet from '@/components/ui/PSheet.vue'

const baseProps = {
  show: true,
  intent: 'publish' as const,
  channelName: '主频道',
  channelCollections: [
    { id: 'collection-1', name: '默认合集', is_default: true },
    { id: 'collection-2', name: '专题合集', is_default: false },
  ],
  selectedCollectionId: 'collection-1',
  summary: '',
  visibility: 'public' as const,
  tags: [],
  coverUrl: '',
  coverUploading: false,
  coverUploadError: '',
  scheduledAt: '',
  scheduling: false,
  saving: null,
  schedule: null,
  warnings: [{ code: 'missing_summary', message: '摘要为空，可补充' }],
  blockingErrors: [],
  error: '',
}

describe('PostPublicationSheet', () => {
  const sheetStub = {
    props: {
      show: Boolean,
      title: String,
      mode: String,
      partialWidth: String,
      top: String,
      abovePlayer: Boolean,
    },
    template: '<div><slot /><slot name="footer" /></div>',
  }

  it('使用窄 partial sheet，正文区域不再渲染底部操作区', () => {
    const wrapper = mount(PostPublicationSheet, {
      props: baseProps,
      global: {
        stubs: {
          PSheet: sheetStub,
          PSegmentedControl: { template: '<div class="publication-mode"><button v-for="option in options" :key="option.value">{{ option.label }}</button></div>', props: ['options', 'modelValue'] },
          PSelect: { template: '<select />' },
          PTextarea: { props: ['label'], template: '<label>{{ label }}</label><textarea />' },
          PInput: { template: '<input />' },
          PostCoverField: true,
        },
      },
    })

    const sheet = wrapper.findComponent(PSheet)
    expect(sheet.props('mode')).toBe('partial')
    expect(sheet.props('partialWidth')).toBe('var(--a-comment-sheet-width)')
    expect(sheet.props('abovePlayer')).toBe(true)
    expect(wrapper.text()).toContain('摘要（可选）')
    expect(sheet.props('top')).toBe('calc(var(--a-topbar-height) + 7rem)')
    expect(wrapper.text()).toContain('立即发布')
    expect(wrapper.text()).toContain('定时发布')
    expect(wrapper.find('.publication-sheet__footer').exists()).toBe(false)
    expect(wrapper.find('[data-testid="publication-confirm"]').exists()).toBe(false)
  })

  it('缺少合集时阻止确认，并展示阻断原因', () => {
    const wrapper = mount(PostPublicationSheet, {
      props: {
        ...baseProps,
        selectedCollectionId: '',
        blockingErrors: ['请选择一个合集'],
      },
      global: {
        stubs: {
          PSheet: sheetStub,
          PSegmentedControl: { template: '<div class="publication-mode"><button v-for="option in options" :key="option.value">{{ option.label }}</button></div>', props: ['options', 'modelValue'] },
          PSelect: { template: '<select />' },
          PTextarea: { props: ['label'], template: '<label>{{ label }}</label><textarea />' },
          PInput: { template: '<input />' },
          PostCoverField: true,
        },
      },
    })

    expect(wrapper.text()).toContain('请选择一个合集')
    expect(wrapper.find('[data-testid="publication-confirm"]').exists()).toBe(false)
  })
})
