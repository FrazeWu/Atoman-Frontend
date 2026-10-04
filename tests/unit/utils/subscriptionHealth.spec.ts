import { describe, expect, it } from 'vitest'

import {
  sourceFetchDiagnostic,
  sourceRecoveryAdvice,
  subscriptionHealthLabel,
  subscriptionHealthStatus,
} from '@/utils/subscriptionHealth'

const subscription = (overrides: Record<string, unknown> = {}) => ({
  id: 'sub-1',
  health_status: 'healthy',
  feed_source: {},
  ...overrides,
}) as any

describe('subscription health helpers', () => {
  it('prioritizes blocked and fetching source states', () => {
    expect(subscriptionHealthStatus(subscription({ feed_source: { fetch_status: 'blocked' } }))).toBe('error')
    expect(subscriptionHealthLabel(subscription({ feed_source: { fetch_status: 'fetching' } }))).toBe('正在刷新')
  })

  it('formats diagnostics and recovery advice', () => {
    const sub = subscription({ feed_source: { fetch_http_status: 429, fetch_consecutive_failures: 3, fetch_last_error_code: 'http_429' } })
    expect(sourceFetchDiagnostic(sub)).toBe('HTTP 429 · 连续失败 3 次')
    expect(sourceRecoveryAdvice(sub)).toContain('自动重试')
  })
})
