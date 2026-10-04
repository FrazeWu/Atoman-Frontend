import type { Subscription } from '@/types'

export type SubscriptionHealth = 'healthy' | 'warning' | 'error'

export function subscriptionHealthStatus(sub: Subscription): SubscriptionHealth {
  const fetchStatus = sub.feed_source?.fetch_status
  if (fetchStatus === 'blocked') return 'error'
  if (fetchStatus === 'warning' || fetchStatus === 'fetching') return 'warning'
  if (fetchStatus === 'healthy') return 'healthy'
  if (sub.feed_source?.health_status === 'error') return 'error'
  return (sub.health_status || 'healthy') as SubscriptionHealth
}

export function subscriptionHealthLabel(sub: Subscription) {
  const fetchStatus = sub.feed_source?.fetch_status
  if (fetchStatus === 'blocked') return '暂时受限'
  if (fetchStatus === 'warning') return '等待重试'
  if (fetchStatus === 'fetching') return '正在刷新'
  return { healthy: '正常', warning: '警告', error: '异常' }[subscriptionHealthStatus(sub)] || '未知'
}

export function sourceFetchDiagnostic(sub: Subscription) {
  const source = sub.feed_source
  if (!source?.fetch_last_error_code && !source?.fetch_http_status && !source?.fetch_consecutive_failures) return ''
  const details: string[] = []
  if (source.fetch_http_status) details.push(`HTTP ${source.fetch_http_status}`)
  else if (source.fetch_last_error_code) details.push(source.fetch_last_error_code)
  if (source.fetch_consecutive_failures) details.push(`连续失败 ${source.fetch_consecutive_failures} 次`)
  return details.join(' · ')
}

export function subscriptionErrorMessage(sub: Subscription) {
  return sub.feed_source?.fetch_last_error || sub.error_message || ''
}

export function sourceRecoveryAdvice(sub: Subscription) {
  switch (sub.feed_source?.fetch_last_error_code) {
    case 'http_401':
    case 'http_403': return '来源拒绝访问，请确认地址是否需要登录或已失效。'
    case 'http_429': return '来源暂时限制请求，系统会自动重试。'
    case 'ssrf_blocked': return '该地址无法从服务端访问，请更新来源地址。'
    case 'parse_failed': return '返回内容无法识别为订阅，请更新来源地址。'
    case 'http_status': return '来源返回异常状态，请稍后重试或更新来源地址。'
    case 'request_failed': return '暂时无法连接来源，系统会自动重试。'
    default: return ''
  }
}
