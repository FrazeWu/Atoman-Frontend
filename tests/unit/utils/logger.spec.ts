import { afterEach, describe, expect, it, vi } from 'vitest'

import { configureErrorReporter, errorMessage, reportError } from '@/utils/logger'

describe('logger', () => {
  afterEach(() => {
    configureErrorReporter(null)
    vi.restoreAllMocks()
  })

  it('forwards errors and context to the configured reporter', () => {
    const reporter = vi.fn()
    const error = new Error('network failed')
    configureErrorReporter(reporter)

    reportError(error, '加载内容失败')

    expect(reporter).toHaveBeenCalledWith(error, '加载内容失败')
  })

  it('uses the development console fallback without a reporter', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    reportError(new Error('network failed'), '加载内容失败')

    expect(consoleError).toHaveBeenCalledOnce()
  })

  it('extracts nested API messages without unsafe casts at call sites', () => {
    expect(errorMessage({ error: { message: '请求已失效' } }, '操作失败')).toBe('请求已失效')
    expect(errorMessage({ error: '权限不足' }, '操作失败')).toBe('权限不足')
    expect(errorMessage(null, '操作失败')).toBe('操作失败')
  })

  it('translates known backend error codes into Chinese user-facing messages', () => {
    expect(errorMessage({ error: { code: 'site_access_conflict' } }, '操作失败'))
      .toBe('站点设置已被其他管理员更新，请刷新后重试')
    expect(errorMessage({ error: { code: 'system.internal_error' } }, '操作失败'))
      .toBe('系统暂时无法完成操作，请稍后重试')
  })
})
