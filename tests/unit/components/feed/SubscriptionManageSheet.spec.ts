import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import SubscriptionManageSheet from '@/components/feed/SubscriptionManageSheet.vue'

const mountSheet = () => mount(SubscriptionManageSheet, {
  props: {
    show: true,
    busy: false,
    healthChecking: false,
    subscriptionRules: [
      {
        id: 'rule-1',
        name: '播客自动整理',
        enabled: true,
        position: 0,
        match_type: 'source_category',
        conditions_json: {
          categories: ['podcast'],
        },
        action_group_id: 'group-1',
        action_muted: true,
        action_auto_mark_read: false,
        action_auto_add_reading_list: true,
      },
    ],
    ruleApplySummary: {
      scanned_count: 12,
      updated_count: 5,
      group_changed_count: 3,
      muted_changed_count: 2,
      auto_mark_read_changed_count: 0,
      auto_add_reading_list_changed_count: 4,
    },
    filterRules: {
      mutedSourceIds: [],
      hiddenKeywords: [],
    },
    automationRules: {
      autoMarkReadSourceIds: [],
      autoAddReadingListSourceIds: [],
    },
    groups: [
      {
        id: 'group-1',
        user_id: 'user-1',
        name: '默认分组',
        created_at: '2026-06-17T00:00:00Z',
        updated_at: '2026-06-17T00:00:00Z',
      },
    ],
    subscriptions: [
      {
        id: 'sub-1',
        user_id: 'user-1',
        feed_source_id: 'source-1',
        title: 'Example Feed',
        subscription_group_id: 'group-1',
        health_status: 'error',
        error_message: 'HTTP 500',
        last_checked: '2026-06-17T08:30:00Z',
        created_at: '2026-06-17T00:00:00Z',
        feed_source: {
          id: 'source-1',
          source_type: 'external_rss',
          rss_url: 'https://example.com/feed.xml',
          hash: 'source-1',
          title: 'Example Feed',
          created_at: '2026-06-17T00:00:00Z',
        },
      },
    ],
  },
  global: {
    stubs: {
      PSheet: { template: '<div><slot /></div>' },
      PField: { props: ['label'], template: '<label><span>{{ label }}</span><slot /></label>' },
      PPress: {
        props: ['label'],
        emits: ['click'],
        template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
      },
      PSelect: {
        props: ['modelValue', 'options'],
        emits: ['update:modelValue'],
        template: '<select :value="modelValue"><option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option></select>',
      },
      SubscriptionRuleEditorSheet: true,
    },
  },
})

describe('SubscriptionManageSheet', () => {
  it('shows the source name instead of the raw rss url in subscription cards', () => {
    const wrapper = mountSheet()

    expect(wrapper.text()).not.toContain('https://example.com/feed.xml')
  })

  it('shows subscription health details and emits health check actions', async () => {
    const wrapper = mountSheet()

    expect(wrapper.text()).toContain('异常')
    expect(wrapper.text()).toContain('HTTP 500')
    expect(wrapper.text()).toContain('2026-06-17 16:30')

    await wrapper.findAll('button').find((button) => button.text() === '全部检查')!.trigger('click')
    await wrapper.findAll('button').find((button) => button.text() === '检查')!.trigger('click')

    expect(wrapper.emitted('check-all-subscriptions-health')).toEqual([[]])
    expect(wrapper.emitted('check-subscription-health')).toEqual([['sub-1']])
  })

  it('emits OPML import and export actions', async () => {
    const wrapper = mountSheet()
    const file = new File(['<opml version="2.0"><body /></opml>'], 'feeds.opml', { type: 'text/xml' })

    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: [file],
      configurable: true,
    })
    await input.trigger('change')
    await wrapper.findAll('button').find((button) => button.text() === '导出 OPML')!.trigger('click')

    expect(wrapper.emitted('import-opml')).toEqual([[file]])
    expect(wrapper.emitted('export-opml')).toEqual([[]])
  })

  it('emits group rename and delete actions', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mountSheet()

    await wrapper.get('[data-test="group-name-input"]').setValue('技术观察')
    await wrapper.get('[data-test="group-name-input"]').trigger('blur')
    await wrapper.findAll('button').find((button) => button.text() === '删除分组')!.trigger('click')

    expect(wrapper.emitted('rename-group')).toEqual([['group-1', '技术观察']])
    expect(wrapper.emitted('delete-group')).toEqual([['group-1']])
    confirm.mockRestore()
  })

  it('keeps only hidden keyword local controls and emits keyword updates', async () => {
    const wrapper = mountSheet()

    await wrapper.get('[data-test="filter-keyword-input"]').setValue('剧透')
    await wrapper.findAll('button').find((button) => button.text() === '添加关键词')!.trigger('click')

    expect(wrapper.emitted('update-filter-rules')).toEqual([
      [{ mutedSourceIds: [], hiddenKeywords: ['剧透'] }],
    ])
    expect(wrapper.text()).not.toContain('静音来源')
    expect(wrapper.text()).not.toContain('自动已读来源')
    expect(wrapper.text()).not.toContain('自动稍后阅读来源')
  })

  it('shows subscription rules summary and emits rule management events', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mountSheet()

    expect(wrapper.text()).toContain('规则管理')
    expect(wrapper.text()).toContain('播客自动整理')
    expect(wrapper.text()).toContain('已启用')
    expect(wrapper.text()).toContain('podcast')
    expect(wrapper.text()).toContain('最近一次应用')
    expect(wrapper.text()).toContain('扫描 12')
    expect(wrapper.text()).toContain('更新 5')

    await wrapper.findAll('button').find((button) => button.text() === '新建规则')!.trigger('click')
    await wrapper.findAll('button').find((button) => button.text() === '重算全部订阅')!.trigger('click')
    await wrapper.findAll('button').find((button) => button.text() === '上移')!.trigger('click')
    await wrapper.findAll('button').find((button) => button.text() === '下移')!.trigger('click')
    await wrapper.findAll('button').find((button) => button.text() === '编辑')!.trigger('click')
    await wrapper.findAll('button').find((button) => button.text() === '应用到已有订阅')!.trigger('click')
    await wrapper.findAll('button').find((button) => button.text() === '删除规则')!.trigger('click')

    expect(wrapper.emitted('create-rule')).toEqual([[]])
    expect(wrapper.emitted('apply-all-rules')).toEqual([[]])
    expect(wrapper.emitted('move-rule-up')).toEqual([['rule-1']])
    expect(wrapper.emitted('move-rule-down')).toEqual([['rule-1']])
    expect(wrapper.emitted('edit-rule')).toEqual([['rule-1']])
    expect(wrapper.emitted('apply-rule')).toEqual([['rule-1']])
    expect(wrapper.emitted('delete-rule')).toEqual([['rule-1']])

    confirm.mockRestore()
  })

  it('opens the rule editor and emits save when editor confirms payload', async () => {
    const wrapper = mount(SubscriptionManageSheet, {
      ...mountSheet().props(),
      props: {
        ...mountSheet().props(),
      },
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
          PField: { props: ['label'], template: '<label><span>{{ label }}</span><slot /></label>' },
          PPress: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PSelect: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue'],
            template: '<select :value="modelValue"><option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option></select>',
          },
          SubscriptionRuleEditorSheet: {
            props: ['show', 'mode', 'groups', 'rule'],
            emits: ['close', 'submit'],
            template: '<div v-if="show" data-test="rule-editor" :data-mode="mode" @click="$emit(\'submit\', { name: \'新闻静音\', enabled: true, match_type: \'source_category\', conditions_json: { categories: [\'news\'] }, action_group_id: \'group-1\', action_muted: true, action_auto_mark_read: false, action_auto_add_reading_list: false })" />',
          },
        },
      },
    })

    await wrapper.findAll('button').find((button) => button.text() === '编辑')!.trigger('click')
    await wrapper.get('[data-test="rule-editor"]').trigger('click')

    expect(wrapper.emitted('save-rule')).toEqual([[
      {
        id: 'rule-1',
        payload: {
          name: '新闻静音',
          enabled: true,
          match_type: 'source_category',
          conditions_json: { categories: ['news'] },
          action_group_id: 'group-1',
          action_muted: true,
          action_auto_mark_read: false,
          action_auto_add_reading_list: false,
        },
      },
    ]])
  })

  it('shows active hidden keywords and does not expose legacy local source automation controls', async () => {
    const wrapper = mount(SubscriptionManageSheet, {
      ...mountSheet().props(),
      props: {
        show: true,
        busy: false,
        healthChecking: false,
        subscriptionRules: [],
        ruleApplySummary: null,
        filterRules: {
          hiddenKeywords: ['剧透'],
          mutedSourceIds: ['source-1'],
        },
        automationRules: {
          autoMarkReadSourceIds: ['source-1'],
          autoAddReadingListSourceIds: ['source-1'],
        },
        groups: [
          {
            id: 'group-1',
            user_id: 'user-1',
            name: '默认分组',
            created_at: '2026-06-17T00:00:00Z',
            updated_at: '2026-06-17T00:00:00Z',
          },
        ],
        subscriptions: [
          {
            id: 'sub-1',
            user_id: 'user-1',
            feed_source_id: 'source-1',
            title: 'Example Feed',
            subscription_group_id: 'group-1',
            created_at: '2026-06-17T00:00:00Z',
            feed_source: {
              id: 'source-1',
              source_type: 'external_rss',
              rss_url: 'https://example.com/feed.xml',
              hash: 'source-1',
              title: 'Example Feed',
              created_at: '2026-06-17T00:00:00Z',
            },
          },
        ],
      },
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
          PField: { props: ['label'], template: '<label><span>{{ label }}</span><slot /></label>' },
          PPress: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PSelect: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue'],
            template: '<select :value="modelValue"><option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option></select>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('剧透')
    expect(wrapper.text()).not.toContain('已静音来源')
    expect(wrapper.text()).not.toContain('自动已读来源')
    expect(wrapper.text()).not.toContain('自动稍后阅读来源')
    expect(wrapper.text()).not.toContain('取消静音')
    expect(wrapper.text()).not.toContain('取消自动已读')
    expect(wrapper.text()).not.toContain('取消自动稍后阅读')

    await wrapper.get('[data-test="hidden-keyword-chip"]').trigger('click')

    expect(wrapper.emitted('update-filter-rules')).toEqual([
      [{ mutedSourceIds: ['source-1'], hiddenKeywords: [] }],
    ])
  })
})
