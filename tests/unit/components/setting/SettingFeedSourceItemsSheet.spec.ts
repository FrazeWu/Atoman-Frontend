import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SettingFeedSourceItemsSheet from '@/components/setting/SettingFeedSourceItemsSheet.vue'

function createSource(overrides: Record<string, unknown> = {}) {
  return {
    id: 'source-1',
    title: '异常源',
    rss_url: 'https://example.com/rss.xml',
    full_text_enabled: true,
    success_count: 8,
    retry_count: 1,
    failed_count: 2,
    pending_count: 1,
    success_rate: 0.8,
    status: 'failing',
    last_sync_status: 'failed',
    last_sync_failed_at: '2026-06-01T10:00:00Z',
    last_sync_error: '连接超时',
    consecutive_sync_failures: 3,
    ...overrides,
  }
}

function createItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    title: '条目',
    link: 'https://example.com/post',
    source_id: 'source-1',
    source_title: '异常源',
    full_text_status: 'success',
    attempt_count: 1,
    published_at: '2026-06-01T08:00:00Z',
    last_attempt_at: '2026-06-01T09:00:00Z',
    ...overrides,
  }
}

describe('SettingFeedSourceItemsSheet', () => {
  it('按失败优先排序条目', () => {
    const wrapper = mount(SettingFeedSourceItemsSheet, {
      props: {
        show: true,
        source: createSource(),
        items: [
          createItem({ id: 'success', title: '成功条目', full_text_status: 'success' }),
          createItem({ id: 'retry', title: '重试条目', full_text_status: 'retry' }),
          createItem({ id: 'failed', title: '失败条目', full_text_status: 'failed' }),
          createItem({ id: 'pending', title: '等待条目', full_text_status: 'pending' }),
        ],
      },
    })

    const titles = wrapper.findAll('.setting-feed-sheet__item h3').map((node) => node.text())
    expect(titles).toEqual(['失败条目', '重试条目', '等待条目', '成功条目'])
  })

  it('失败条目可以触发 retry', async () => {
    const wrapper = mount(SettingFeedSourceItemsSheet, {
      props: {
        show: true,
        source: createSource(),
        items: [
          createItem({
            id: 'failed',
            title: '失败条目',
            full_text_status: 'failed',
            error_message: '抓取失败',
          }),
        ],
      },
    })

    const retryButton = wrapper.findAll('button').find((node) => node.text() === '手动重试')
    expect(retryButton).toBeTruthy()

    await retryButton!.trigger('click')

    expect(wrapper.emitted('retry')).toEqual([['failed']])
    expect(wrapper.text()).toContain('连接超时')
    expect(wrapper.text()).toContain('同步连续失败 3')
  })
})
