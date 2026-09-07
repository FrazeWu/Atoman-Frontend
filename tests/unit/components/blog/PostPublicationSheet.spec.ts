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
  canConfirm: true,
}

describe('PostPublicationSheet', () => {
  const sheetStub = {
    props: {
      show: Boolean,
      title: String,
      mode: String,
      partialWidth: String,
      abovePlayer: Boolean,
    },
    template: '<div><slot /><slot name="footer" /></div>',
  }

  it('使用窄 partial sheet，摘要为空仍允许确认发布', () => {
    const wrapper = mount(PostPublicationSheet, {
      props: baseProps,
      global: {
        stubs: {
          PSheet: sheetStub,
          PSelect: { template: '<select />' },
          PTextarea: { props: ['label'], template: '<label>{{ label }}</label><textarea />' },
          PInput: { template: '<input />' },
          PostCoverField: true,
          PButton: { template: '<button :disabled="disabled"><slot /></button>', props: ['disabled'] },
        },
      },
    })

    const sheet = wrapper.findComponent(PSheet)
    expect(sheet.props('mode')).toBe('partial')
    expect(sheet.props('partialWidth')).toBe('var(--a-recommendation-width)')
    expect(sheet.props('abovePlayer')).toBe(true)
    expect(wrapper.text()).toContain('摘要（可选）')
    expect(wrapper.find('[data-testid="publication-confirm"]').attributes('disabled')).toBeUndefined()
  })

  it('缺少合集时阻止确认，并展示阻断原因', () => {
    const wrapper = mount(PostPublicationSheet, {
      props: {
        ...baseProps,
        selectedCollectionId: '',
        blockingErrors: ['请选择一个合集'],
        canConfirm: false,
      },
      global: {
        stubs: {
          PSheet: sheetStub,
          PSelect: { template: '<select />' },
          PTextarea: { props: ['label'], template: '<label>{{ label }}</label><textarea />' },
          PInput: { template: '<input />' },
          PostCoverField: true,
          PButton: { template: '<button :disabled="disabled"><slot /></button>', props: ['disabled'] },
        },
      },
    })

    expect(wrapper.text()).toContain('请选择一个合集')
    expect(wrapper.find('[data-testid="publication-confirm"]').attributes('disabled')).toBeDefined()
  })

  it('定时发布使用同一个确认按钮文案', () => {
    const wrapper = mount(PostPublicationSheet, {
      props: { ...baseProps, intent: 'schedule' },
      global: {
        stubs: {
          PSheet: sheetStub,
          PSelect: { template: '<select />' },
          PTextarea: { props: ['label'], template: '<label>{{ label }}</label><textarea />' },
          PInput: { template: '<input />' },
          PostCoverField: true,
          PButton: { template: '<button :disabled="disabled"><slot /></button>', props: ['disabled'] },
        },
      },
    })

    expect(wrapper.get('[data-testid="publication-confirm"]').text()).toContain('确认定时发布')
  })
})
