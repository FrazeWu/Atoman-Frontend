import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SubscriptionManageSheet from '@/components/feed/SubscriptionManageSheet.vue'

const stubs = {
  PSheet: { props: ['show', 'title'], template: '<section v-if="show"><slot /></section>' },
  PField: { template: '<label><slot /></label>' },
  PInput: { template: '<input />' },
  PPress: {
    props: ['label', 'disabled'],
    emits: ['click'],
    template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
  },
  PSelect: true,
  SubscriptionRulesPanel: true,
}

const mountSheet = () => mount(SubscriptionManageSheet, {
  props: {
    show: true,
    subscriptions: [
      {
        id: 'external-sub',
        user_id: 'user-1',
        feed_source_id: 'external-source',
        title: 'External Feed',
        feed_source: {
          id: 'external-source',
          source_type: 'external_rss',
          hash: 'external-source',
          title: 'External Feed',
          rss_url: 'https://example.com/feed.xml',
          last_fetched_at: '2026-07-20T02:00:00Z',
          created_at: '2026-07-20T00:00:00Z',
        },
        created_at: '2026-07-20T00:00:00Z',
      },
      {
        id: 'internal-sub',
        user_id: 'user-1',
        feed_source_id: 'internal-source',
        title: 'Internal Feed',
        feed_source: {
          id: 'internal-source',
          source_type: 'internal_channel',
          hash: 'internal-source',
          title: 'Internal Feed',
          created_at: '2026-07-20T00:00:00Z',
        },
        created_at: '2026-07-20T00:00:00Z',
      },
    ],
    groups: [],
    subscriptionRules: [],
    ruleApplySummary: null,
    filterRules: { mutedSourceIds: [], hiddenKeywords: [] },
    automationRules: { autoMarkReadSourceIds: [], autoReadingListSourceIds: [] },
    syncingSubscriptionIds: new Set<string>(),
    syncingAllSubscriptions: false,
    subscriptionSyncResults: {
      'external-sub': {
        subscription_id: 'external-sub',
        feed_source_id: 'external-source',
        fetched_items: 5,
        new_items: 3,
        synced_at: '2026-07-20T02:00:00Z',
        success: true,
      },
    },
  },
  global: { stubs },
})

describe('SubscriptionManageSheet sync controls', () => {
  it('refreshes all sources and only offers per-source refresh for external RSS', async () => {
    const wrapper = mountSheet()
    const refreshAll = wrapper.get('button[data-test="sync-all-subscriptions"]')
    await refreshAll.trigger('click')
    expect(wrapper.emitted('sync-all-subscriptions')).toHaveLength(1)

    const refreshButtons = wrapper.findAll('button[data-test="sync-subscription"]')
    expect(refreshButtons).toHaveLength(1)
    await refreshButtons[0]!.trigger('click')
    expect(wrapper.emitted('sync-subscription')).toEqual([['external-sub']])
  })

  it('shows the latest fetch time and new item count', () => {
    const wrapper = mountSheet()
    expect(wrapper.text()).toContain('最近更新')
    expect(wrapper.text()).toContain('新增 3 篇')
  })

  it('disables refresh-all while one source is refreshing', async () => {
    const wrapper = mountSheet()
    await wrapper.setProps({ syncingSubscriptionIds: new Set(['external-sub']) })

    const refreshAll = wrapper.get('button[data-test="sync-all-subscriptions"]')
    expect(refreshAll.attributes('disabled')).toBeDefined()
    await refreshAll.trigger('click')
    expect(wrapper.emitted('sync-all-subscriptions')).toBeUndefined()
  })
})
