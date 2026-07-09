import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SubscriptionRulesPanel from '@/components/feed/SubscriptionRulesPanel.vue'

describe('SubscriptionRulesPanel', () => {
  it('shows source names for source id rule conditions', () => {
    const wrapper = mount(SubscriptionRulesPanel, {
      props: {
        groups: [],
        subscriptions: [
          {
            id: 'sub-1',
            user_id: 'user-1',
            feed_source_id: 'source-1',
            title: 'https://example.com/feed.xml',
            created_at: '2026-07-10T00:00:00Z',
            feed_source: {
              id: 'source-1',
              source_type: 'external_rss',
              rss_url: 'https://example.com/feed.xml',
              hash: 'source-1',
              title: 'Example Feed',
              created_at: '2026-07-10T00:00:00Z',
            },
          },
        ],
        subscriptionRules: [
          {
            id: 'rule-1',
            name: '指定来源自动已读',
            enabled: true,
            position: 0,
            match_type: 'source_ids',
            conditions_json: { source_ids: ['source-1'] },
            action_auto_mark_read: true,
          },
        ],
        ruleApplySummary: null,
        busy: false,
      },
      global: {
        stubs: {
          PPress: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          SubscriptionRuleEditorSheet: true,
        },
      },
    })

    expect(wrapper.text()).toContain('条件：来源 Example Feed')
    expect(wrapper.text()).not.toContain('source-1')
    expect(wrapper.text()).not.toContain('https://example.com/feed.xml')
  })
})
