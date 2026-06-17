import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SubscriptionAddSheet from '@/components/feed/SubscriptionAddSheet.vue'

const discoverFeedCandidates = vi.fn()

vi.mock('@/stores/feed', () => ({
  useFeedStore: () => ({
    discoverFeedCandidates,
  }),
}))

describe('SubscriptionAddSheet', () => {
  afterEach(() => {
    discoverFeedCandidates.mockReset()
  })

  it('uses selected discovered feed title when custom title is empty', async () => {
    discoverFeedCandidates.mockResolvedValue([
      {
        feed_url: 'https://example.com/feed.xml',
        title: 'Example Blog',
        kind: 'rss',
        is_default: true,
      },
    ])

    const wrapper = mount(SubscriptionAddSheet, {
      props: {
        show: true,
        groups: [],
        submitting: false,
        error: '',
      },
      global: {
        stubs: {
          PSheet: {
            template: '<div><slot /></div>',
          },
          PField: {
            template: '<label><slot /></label>',
          },
          PPress: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PClip: {
            props: ['label', 'active'],
            emits: ['click'],
            template: '<button type="button" :data-active="active" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PSelect: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue'],
            template: '<select />',
          },
        },
      },
    })

    await wrapper.get('input[placeholder="https://example.com"]').setValue('https://example.com')
    await wrapper.findAll('button').find((button) => button.text() === '查找订阅源')!.trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.findAll('button').find((button) => button.text() === '确认订阅')!.trigger('click')

    expect(wrapper.emitted('submit-discovered')).toEqual([[
      {
        feed_url: 'https://example.com/feed.xml',
        title: 'Example Blog',
        group_id: '',
      },
    ]])
  })

  it('keeps custom title when subscribing to a discovered feed', async () => {
    discoverFeedCandidates.mockResolvedValue([
      {
        feed_url: 'https://example.com/feed.xml',
        title: 'Example Blog',
        kind: 'rss',
        is_default: true,
      },
    ])

    const wrapper = mount(SubscriptionAddSheet, {
      props: {
        show: true,
        groups: [],
        submitting: false,
        error: '',
      },
      global: {
        stubs: {
          PSheet: {
            template: '<div><slot /></div>',
          },
          PField: {
            template: '<label><slot /></label>',
          },
          PPress: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PClip: {
            props: ['label', 'active'],
            emits: ['click'],
            template: '<button type="button" :data-active="active" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PSelect: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue'],
            template: '<select />',
          },
        },
      },
    })

    await wrapper.get('input[placeholder="https://example.com"]').setValue('https://example.com')
    await wrapper.get('input[placeholder="例如：GitHub Blog"]').setValue('Custom Blog')
    await wrapper.findAll('button').find((button) => button.text() === '查找订阅源')!.trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.findAll('button').find((button) => button.text() === '确认订阅')!.trigger('click')

    expect(wrapper.emitted('submit-discovered')).toEqual([[
      {
        feed_url: 'https://example.com/feed.xml',
        title: 'Custom Blog',
        group_id: '',
      },
    ]])
  })

  it('resets mode and selected group to default semantics when resetKey changes', async () => {
    const wrapper = mount(SubscriptionAddSheet, {
      props: {
        show: true,
        groups: [
          { id: 'default-group', name: '默认分组' },
          { id: 'custom-group', name: '技术' },
        ],
        submitting: false,
        error: '',
        resetKey: 0,
      },
      global: {
        stubs: {
          PSheet: {
            template: '<div><slot /></div>',
          },
          PField: {
            template: '<label><slot /></label>',
          },
          PPress: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PClip: {
            props: ['label', 'active'],
            emits: ['click'],
            template: '<button type="button" :data-active="active" @click="$emit(\'click\')">{{ label }}</button>',
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
                <option
                  v-for="option in options"
                  :key="String(option.value)"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            `,
          },
        },
      },
    })

    const clips = wrapper.findAll('button').filter((button) => ['发现', 'RSS', 'RSSHub'].includes(button.text()))
    await clips[1].trigger('click')
    await wrapper.get('[data-testid="group-select"]').setValue('custom-group')
    await wrapper.get('input[placeholder="例如：GitHub Blog"]').setValue('Custom title')

    await wrapper.setProps({ resetKey: 1 })

    const discoverClip = wrapper.findAll('button').find((button) => button.text() === '发现')
    expect(discoverClip?.attributes('data-active')).toBe('true')
    expect(wrapper.get('[data-testid="group-select"]').element.value).toBe('default-group')
    expect(wrapper.get('input[placeholder="例如：GitHub Blog"]').element.value).toBe('')
  })
})
