import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SubscriptionRuleEditorSheet from '@/components/feed/SubscriptionRuleEditorSheet.vue'
import type { FeedSubscriptionRule, Subscription } from '@/types'

const subscriptions: Subscription[] = [
  {
    id: 'sub-1',
    user_id: 'user-1',
    feed_source_id: 'source-1',
    title: 'https://example.com/feed.xml',
    created_at: '2026-01-01T00:00:00Z',
    feed_source: {
      id: 'source-1',
      source_type: 'external_rss',
      rss_url: 'https://example.com/feed.xml',
      hash: 'source-1',
      title: 'Example Feed',
      created_at: '2026-01-01T00:00:00Z',
    },
  },
]

const mountEditor = (props: {
  mode?: 'create' | 'edit'
  rule?: FeedSubscriptionRule | null
  subscriptions?: Subscription[]
} = {}) => mount(SubscriptionRuleEditorSheet, {
  props: {
    show: true,
    mode: props.mode || 'create',
    groups: [
      {
        id: 'group-1',
        user_id: 'user-1',
        name: '播客',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ],
    rule: props.rule,
    subscriptions: props.subscriptions || [],
  },
  global: {
    stubs: {
      PSheet: { template: '<section><slot /></section>' },
      PField: { props: ['label'], template: '<label><span>{{ label }}</span><slot /></label>' },
      PInput: {
        props: ['modelValue'],
        emits: ['update:modelValue'],
        template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
      },
      PPress: {
        props: ['label', 'disabled'],
        emits: ['click'],
        template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
      },
      PSelect: {
        props: ['modelValue', 'options'],
        emits: ['update:modelValue'],
        template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option></select>',
      },
      PTextarea: true,
    },
  },
})

describe('SubscriptionRuleEditorSheet', () => {
  it('does not submit a rule without any action', async () => {
    const wrapper = mountEditor()

    await wrapper.find('input').setValue('播客整理')
    await wrapper.findAll('input[type="checkbox"]')[0].setValue(true)
    await wrapper.findAll('button').find((button) => button.text() === '保存规则')!.trigger('click')

    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('submits when a condition and an action are selected', async () => {
    const wrapper = mountEditor()

    await wrapper.find('input').setValue('播客整理')
    await wrapper.findAll('input[type="checkbox"]')[0].setValue(true)
    await wrapper.findAll('input[type="checkbox"]')[7].setValue(true)
    await wrapper.findAll('button').find((button) => button.text() === '保存规则')!.trigger('click')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      name: '播客整理',
      match_type: 'source_category',
      conditions_json: { categories: ['blog'] },
      action_auto_mark_read: true,
    })
  })

  it('normalizes an existing singular category condition when editing', async () => {
    const wrapper = mountEditor({
      mode: 'edit',
      rule: {
        id: 'rule-1',
        name: '博客静音',
        enabled: true,
        position: 0,
        match_type: 'source_category',
        conditions_json: { category: 'blog' },
        action_muted: true,
      },
    })

    await wrapper.findAll('button').find((button) => button.text() === '保存规则')!.trigger('click')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      name: '博客静音',
      match_type: 'source_category',
      conditions_json: { categories: ['blog'] },
      action_muted: true,
    })
  })

  it('submits selected source ids from subscription choices', async () => {
    const wrapper = mountEditor({ subscriptions })

    await wrapper.find('input').setValue('来源自动已读')
    await wrapper.findAll('select')[0].setValue('source_ids')

    expect(wrapper.text()).toContain('Example Feed')

    await wrapper.get('[data-test="rule-source-option-source-1"]').setValue(true)
    await wrapper.get('[data-test="rule-action-auto-read"]').setValue(true)
    await wrapper.findAll('button').find((button) => button.text() === '保存规则')!.trigger('click')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      name: '来源自动已读',
      match_type: 'source_ids',
      conditions_json: { source_ids: ['source-1'] },
      action_auto_mark_read: true,
    })
  })

  it('shows source ids that are already in the rule even when the source is missing locally', async () => {
    const wrapper = mountEditor({
      mode: 'edit',
      subscriptions,
      rule: {
        id: 'rule-1',
        name: '旧来源自动已读',
        enabled: true,
        position: 0,
        match_type: 'source_ids',
        conditions_json: { source_ids: ['source-missing'] },
        action_auto_mark_read: true,
      },
    })

    expect(wrapper.text()).toContain('source-missing')

    await wrapper.findAll('button').find((button) => button.text() === '保存规则')!.trigger('click')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      name: '旧来源自动已读',
      match_type: 'source_ids',
      conditions_json: { source_ids: ['source-missing'] },
      action_auto_mark_read: true,
    })
  })
})
