import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import SubscriptionManageSheet from '@/components/feed/SubscriptionManageSheet.vue'

const mountSheet = () => mount(SubscriptionManageSheet, {
  props: {
    show: true,
    busy: false,
    healthChecking: false,
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
})
