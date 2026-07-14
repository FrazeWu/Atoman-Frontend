import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import SubscriptionManageSheet from '@/components/feed/SubscriptionManageSheet.vue'

const mountSheet = () => mount(SubscriptionManageSheet, {
  props: {
    show: true,
    busy: false,
    healthChecking: false,
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
    expect(wrapper.text()).toContain('2026-06-17')

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

  it('emits filter rule updates when muting a source and adding a keyword', async () => {
    const wrapper = mountSheet()

    await wrapper.findAll('button').find((button) => button.text() === '静音来源')!.trigger('click')
    await wrapper.get('[data-test="filter-keyword-input"]').setValue('剧透')
    await wrapper.findAll('button').find((button) => button.text() === '添加关键词')!.trigger('click')

    expect(wrapper.emitted('update-filter-rules')).toEqual([
      [{ mutedSourceIds: ['source-1'], hiddenKeywords: [] }],
      [{ mutedSourceIds: ['source-1'], hiddenKeywords: ['剧透'] }],
    ])
  })

  it('emits automation rule updates when toggling source automation actions', async () => {
    const wrapper = mountSheet()

    await wrapper.findAll('button').find((button) => button.text() === '自动已读')!.trigger('click')
    await wrapper.findAll('button').find((button) => button.text() === '自动稍后阅读')!.trigger('click')

    expect(wrapper.emitted('update-automation-rules')).toEqual([
      [{
        autoMarkReadSourceIds: ['source-1'],
        autoAddReadingListSourceIds: [],
      }],
      [{
        autoMarkReadSourceIds: ['source-1'],
        autoAddReadingListSourceIds: ['source-1'],
      }],
    ])
  })

  it('shows active filter rules and allows removing them', async () => {
    const wrapper = mount(SubscriptionManageSheet, {
      ...mountSheet().props(),
      props: {
        show: true,
        busy: false,
        healthChecking: false,
        filterRules: {
          mutedSourceIds: ['source-1'],
          hiddenKeywords: ['剧透'],
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

    expect(wrapper.text()).toContain('已静音来源')
    expect(wrapper.text()).toContain('自动已读来源')
    expect(wrapper.text()).toContain('自动稍后阅读来源')
    expect(wrapper.text()).toContain('Example Feed')
    expect(wrapper.text()).toContain('剧透')

    await wrapper.get('[data-test="muted-source-chip"]').trigger('click')
    await wrapper.get('[data-test="hidden-keyword-chip"]').trigger('click')
    await wrapper.get('[data-test="auto-read-source-chip"]').trigger('click')
    await wrapper.get('[data-test="auto-reading-list-source-chip"]').trigger('click')

    expect(wrapper.emitted('update-filter-rules')).toEqual([
      [{ mutedSourceIds: [], hiddenKeywords: ['剧透'] }],
      [{ mutedSourceIds: [], hiddenKeywords: [] }],
    ])
    expect(wrapper.emitted('update-automation-rules')).toEqual([
      [{
        autoMarkReadSourceIds: [],
        autoAddReadingListSourceIds: ['source-1'],
      }],
      [{
        autoMarkReadSourceIds: [],
        autoAddReadingListSourceIds: [],
      }],
    ])
  })
})
