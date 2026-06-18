import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SubscriptionAddSheet from '@/components/feed/SubscriptionAddSheet.vue'

const resolveSubscriptionInput = vi.fn()

vi.mock('@/stores/feed', () => ({
  useFeedStore: () => ({
    resolveSubscriptionInput,
    error: null,
  }),
}))

const mountSheet = (props = {}) => mount(SubscriptionAddSheet, {
  props: {
    show: true,
    groups: [],
    submitting: false,
    error: '',
    ...props,
  },
  global: {
    stubs: {
      PSheet: { template: '<div><slot /></div>' },
      PField: { props: ['label'], template: '<label><span>{{ label }}</span><slot /></label>' },
      PPress: {
        props: ['label', 'disabled', 'loading', 'loadingText'],
        emits: ['click'],
        template: '<button type="button" :disabled="disabled || loading" @click="$emit(\'click\')">{{ loading ? loadingText : label }}</button>',
      },
      PSelect: {
        props: ['modelValue', 'options'],
        emits: ['update:modelValue'],
        template: `
          <select
            data-testid="group-select"
            :value="modelValue"
            @change="$emit('update:modelValue', $event.target.value)"
          >
            <option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
          </select>
        `,
      },
    },
  },
})

describe('SubscriptionAddSheet', () => {
  afterEach(() => {
    resolveSubscriptionInput.mockReset()
    vi.useRealTimers()
  })

  it('resolves input after typing and submits unified payload for an existing source', async () => {
    vi.useFakeTimers()
    resolveSubscriptionInput.mockResolvedValue({
      status: 'existing_source',
      source: {
        id: 'source-1',
        provider: 'rss',
        source_type: 'external_rss',
        title: 'Example Feed',
        rss_url: 'https://example.com/feed.xml',
        canonical_url: 'https://example.com/feed.xml',
      },
      candidates: [],
      message: '来源已存在，可添加到你的订阅',
    })
    const wrapper = mountSheet()

    await wrapper.get('input[placeholder="输入网站、RSS 或 GitHub 仓库地址"]').setValue('https://example.com/feed.xml')
    await vi.advanceTimersByTimeAsync(500)
    await flushPromises()

    expect(resolveSubscriptionInput).toHaveBeenCalledWith('https://example.com/feed.xml')
    expect(wrapper.text()).toContain('来源已存在，可添加到你的订阅')

    await wrapper.findAll('button').find((button) => button.text() === '确认订阅')!.trigger('click')

    expect(wrapper.emitted('submit')).toEqual([[
      {
        input: 'https://example.com/feed.xml',
        candidate_feed_url: undefined,
        title: 'Example Feed',
        group_id: '',
      },
    ]])
  })

  it('disables submit when the source is already subscribed', async () => {
    vi.useFakeTimers()
    resolveSubscriptionInput.mockResolvedValue({
      status: 'already_subscribed',
      source: {
        id: 'source-1',
        provider: 'rss',
        source_type: 'external_rss',
        title: 'Example Feed',
        rss_url: 'https://example.com/feed.xml',
        canonical_url: 'https://example.com/feed.xml',
      },
      subscription: { id: 'sub-1' },
      candidates: [],
      message: '你已订阅此来源',
    })
    const wrapper = mountSheet()

    await wrapper.get('input[placeholder="输入网站、RSS 或 GitHub 仓库地址"]').setValue('https://example.com/feed.xml')
    await vi.advanceTimersByTimeAsync(500)
    await flushPromises()

    const submit = wrapper.findAll('button').find((button) => button.text() === '确认订阅')!
    expect(submit.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('你已订阅此来源')
  })

  it('requires selecting a candidate when multiple feeds are discovered', async () => {
    vi.useFakeTimers()
    resolveSubscriptionInput.mockResolvedValue({
      status: 'multiple_candidates',
      source: null,
      candidates: [
        {
          title: 'Main Feed',
          feed_url: 'https://example.com/feed.xml',
          site_url: 'https://example.com',
          kind: 'main',
          score: 40,
          is_default: true,
          status: 'new_source',
          source: {
            provider: 'rss',
            source_type: 'external_rss',
            title: 'Main Feed',
            rss_url: 'https://example.com/feed.xml',
            canonical_url: 'https://example.com/feed.xml',
          },
        },
      ],
      message: '请选择一个订阅源',
    })
    const wrapper = mountSheet()

    await wrapper.get('input[placeholder="输入网站、RSS 或 GitHub 仓库地址"]').setValue('https://example.com')
    await vi.advanceTimersByTimeAsync(500)
    await flushPromises()

    expect(wrapper.text()).toContain('请选择一个订阅源')
    await wrapper.find('button.candidate-option').trigger('click')
    await wrapper.findAll('button').find((button) => button.text() === '确认订阅')!.trigger('click')

    expect(wrapper.emitted('submit')).toEqual([[
      {
        input: 'https://example.com',
        candidate_feed_url: 'https://example.com/feed.xml',
        title: 'Main Feed',
        group_id: '',
      },
    ]])
  })

  it('shows and blocks an already subscribed candidate in multiple results', async () => {
    vi.useFakeTimers()
    resolveSubscriptionInput.mockResolvedValue({
      status: 'multiple_candidates',
      source: null,
      candidates: [
        {
          title: 'Main Feed',
          feed_url: 'https://example.com/feed.xml',
          site_url: 'https://example.com',
          kind: 'main',
          score: 40,
          is_default: true,
          status: 'already_subscribed',
          subscription: { id: 'sub-1' },
          source: {
            id: 'source-1',
            provider: 'rss',
            source_type: 'external_rss',
            title: 'Main Feed',
            rss_url: 'https://example.com/feed.xml',
            canonical_url: 'https://example.com/feed.xml',
          },
        },
        {
          title: 'Updates',
          feed_url: 'https://example.com/updates.atom',
          site_url: 'https://example.com',
          kind: 'alternate',
          score: 30,
          is_default: false,
          status: 'new_source',
          source: {
            provider: 'rss',
            source_type: 'external_rss',
            title: 'Updates',
            rss_url: 'https://example.com/updates.atom',
            canonical_url: 'https://example.com/updates.atom',
          },
        },
      ],
      message: '请选择一个订阅源',
    })
    const wrapper = mountSheet()

    await wrapper.get('input[placeholder="输入网站、RSS 或 GitHub 仓库地址"]').setValue('https://example.com')
    await vi.advanceTimersByTimeAsync(500)
    await flushPromises()

    expect(wrapper.text()).toContain('已订阅')

    await wrapper.findAll('button.candidate-option')[0].trigger('click')
    const submit = wrapper.findAll('button').find((button) => button.text() === '确认订阅')!
    expect(submit.attributes('disabled')).toBeDefined()

    await wrapper.findAll('button.candidate-option')[1].trigger('click')
    expect(submit.attributes('disabled')).toBeUndefined()
  })

  it('resets input, resolved state, and selected group when resetKey changes', async () => {
    const wrapper = mountSheet({
      groups: [
        { id: 'default-group', name: '默认分组' },
        { id: 'custom-group', name: '技术' },
      ],
      resetKey: 0,
    })

    await wrapper.get('input[placeholder="输入网站、RSS 或 GitHub 仓库地址"]').setValue('https://example.com/feed.xml')
    await wrapper.get('[data-testid="group-select"]').setValue('custom-group')
    await wrapper.get('input[placeholder="例如：GitHub Blog"]').setValue('Custom title')

    await wrapper.setProps({ resetKey: 1 })

    expect(wrapper.get('input[placeholder="输入网站、RSS 或 GitHub 仓库地址"]').element.value).toBe('')
    expect(wrapper.get('[data-testid="group-select"]').element.value).toBe('default-group')
    expect(wrapper.get('input[placeholder="例如：GitHub Blog"]').element.value).toBe('')
  })

  it('ignores a stale resolve result after the input is cleared', async () => {
    vi.useFakeTimers()
    let resolveRequest!: (value: unknown) => void
    resolveSubscriptionInput.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve
    }))
    const wrapper = mountSheet()

    await wrapper.get('input[placeholder="输入网站、RSS 或 GitHub 仓库地址"]').setValue('https://example.com/feed.xml')
    await vi.advanceTimersByTimeAsync(500)
    await wrapper.get('input[placeholder="输入网站、RSS 或 GitHub 仓库地址"]').setValue('')

    resolveRequest({
      status: 'existing_source',
      source: {
        id: 'source-1',
        provider: 'rss',
        source_type: 'external_rss',
        title: 'Example Feed',
        rss_url: 'https://example.com/feed.xml',
        canonical_url: 'https://example.com/feed.xml',
      },
      candidates: [],
      message: '来源已存在，可添加到你的订阅',
    })
    await flushPromises()

    expect(wrapper.text()).not.toContain('来源已存在，可添加到你的订阅')
    expect(wrapper.find('.resolved-source').exists()).toBe(false)
  })
})
