import type { Router } from 'vue-router'
import { reportError } from '@/utils/logger'

const recoveryTimeKey = 'atoman_chunk_load_recovery_time'
const recoveryAttemptKey = 'atoman_chunk_load_recovery_attempts'
const recoveryWindowMs = 30000
const recoveryRetryDelayMs = 1500
const maxRecoveryAttempts = 3
let recoveryScheduled = false
let recoveryResetTimer: number | undefined

function cancelRecoveryReset() {
  if (recoveryResetTimer === undefined) return
  window.clearTimeout(recoveryResetTimer)
  recoveryResetTimer = undefined
}

function scheduleRecoveryReset() {
  cancelRecoveryReset()
  recoveryResetTimer = window.setTimeout(() => {
    sessionStorage.removeItem(recoveryTimeKey)
    sessionStorage.removeItem(recoveryAttemptKey)
    recoveryResetTimer = undefined
  }, recoveryWindowMs)
}

// 涵盖 Chrome、Firefox、Safari、Edge 等主流浏览器关于 Chunk/Module 丢失与 MIME 拦截的错误特征
const chunkLoadErrorPattern = new RegExp([
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
  'unable to preload css',
  'disallowed mime type',
  'mime type',
  'failed to load module script',
  'networkerror when attempting to fetch resource',
  'loading module from',
  'fetch dynamically imported module',
  'loading chunk',
  'dynamically imported module'
].join('|'), 'i')

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? (error.stack || '') : ''
  return chunkLoadErrorPattern.test(message) || chunkLoadErrorPattern.test(stack)
}

/**
 * 判断触发 Resource Error 的 DOM 元素是否为本应用打包出的 JS/CSS Chunk 资源
 * 严格剔除 Cloudflare 注入脚本 (/cdn-cgi/)、第三方 SDK、广告拦截/跟踪拦截等非应用静态资源
 */
export function isAppChunkElement(target: HTMLElement | null): boolean {
  if (!target) return false
  const tagName = target.tagName
  if (tagName !== 'SCRIPT' && tagName !== 'LINK') return false

  const src = (target as HTMLScriptElement).src || (target as HTMLLinkElement).href
  if (!src) return false

  // 忽略 Cloudflare 托管脚本与 Beacon (如 /cdn-cgi/challenge-platform/..., /cdn-cgi/rum...)
  if (src.includes('/cdn-cgi/')) return false

  try {
    const url = new URL(src, window.location.origin)
    // 必须是本应用同源或 assets 资产目录下的 bundle 文件
    if (url.origin === window.location.origin || url.pathname.includes('/assets/')) {
      return url.pathname.includes('/assets/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')
    }
  } catch {
    return src.includes('/assets/')
  }

  return false
}

/**
 * 成功加载页面后，自动清理 URL 中的 `_cc_refresh` 强刷参数，保持用户地址栏整洁
 */
export function cleanupRefreshParam() {
  try {
    if (typeof window === 'undefined' || !window.location) return
    const urlObj = new URL(window.location.href)
    if (urlObj.searchParams.has('_cc_refresh')) {
      urlObj.searchParams.delete('_cc_refresh')
      const cleanUrl = urlObj.pathname + urlObj.search + urlObj.hash
      window.history.replaceState(window.history.state, '', cleanUrl)
    }
  } catch {
    // History API restriction fallback
  }
}

function triggerRecoveryReload(targetUrl?: string) {
  try {
    cancelRecoveryReset()
    const now = Date.now()
    const lastRecoveryTime = parseInt(sessionStorage.getItem(recoveryTimeKey) || '0', 10)
    const attempts = parseInt(sessionStorage.getItem(recoveryAttemptKey) || '0', 10)

    if (recoveryScheduled || attempts >= maxRecoveryAttempts) return

    const currentPath = targetUrl || window.location.href
    const delay = attempts > 0
      ? Math.max(0, recoveryRetryDelayMs - (now - lastRecoveryTime))
      : 0

    const reload = () => {
      recoveryScheduled = false
      const reloadTime = Date.now()
      sessionStorage.setItem(recoveryTimeKey, String(reloadTime))
      sessionStorage.setItem(recoveryAttemptKey, String(attempts + 1))

      const urlObj = new URL(currentPath, window.location.origin)
      urlObj.searchParams.set('_cc_refresh', String(reloadTime))
      window.location.replace(urlObj.toString())
    }

    recoveryScheduled = true
    if (delay > 0) {
      window.setTimeout(reload, delay)
    } else {
      reload()
    }
  } catch (e) {
    recoveryScheduled = false
    reportError(e, 'Failed to trigger chunk recovery reload')
    window.location.reload()
  }
}

export function installChunkLoadRecovery(router: Router) {
  let pendingRouteUrl = ''

  // 初始化时清理 URL 中的 _cc_refresh 参数
  cleanupRefreshParam()

  // Resource Error 可能先于 router.onError 到达，需提前保存真实导航目标。
  router.beforeEach((to) => {
    pendingRouteUrl = window.location.origin + to.fullPath
  })

  // 1. Vue Router 路由加载错误捕获
  router.onError((error, to) => {
    reportError(error, '路由或Chunk资源加载失败')
    if (isChunkLoadError(error)) {
      triggerRecoveryReload(window.location.origin + to.fullPath)
    }
  })

  router.afterEach((_to, _from, failure) => {
    try {
      cleanupRefreshParam()
      if (!failure) {
        pendingRouteUrl = ''
        scheduleRecoveryReset()
      }
    } catch {
      // Storage restriction fallback
    }
  })

  // 2. 全局 Promise Unhandled Rejection 监听（捕获组件级 defineAsyncComponent 或 script 引入错误）
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      event.preventDefault()
      reportError(event.reason, '全局检测到 Chunk 资源失效，正在自动刷新并加载最新页面...')
      triggerRecoveryReload(pendingRouteUrl || window.location.href)
    }
  })

  // 3. 全局 Resource Error 监听（仅捕获应用内部 SCRIPT / LINK /assets/ 静态文件加载 404 或 MIME 拦截）
  window.addEventListener(
    'error',
    (event) => {
      const target = event.target as HTMLElement | null
      if (isAppChunkElement(target)) {
        const src = (target as HTMLScriptElement).src || (target as HTMLLinkElement).href
        reportError(event.error || event.message, `静态资源加载错误: ${src}`)
        triggerRecoveryReload(pendingRouteUrl || window.location.href)
      }
    },
    true
  )
}
