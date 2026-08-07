import type { Router } from 'vue-router'
import { reportError } from '@/utils/logger'

const recoveryTimeKey = 'atoman_chunk_load_recovery_time'

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
    const now = Date.now()
    const lastRecoveryTime = parseInt(sessionStorage.getItem(recoveryTimeKey) || '0', 10)

    // 10秒内只允许触发一次重新加载，防止陷入无限死循环
    if (now - lastRecoveryTime < 10000) {
      return
    }

    sessionStorage.setItem(recoveryTimeKey, String(now))
    const currentPath = targetUrl || window.location.href

    // 构造带时间戳的强刷 URL，彻底打穿 Firefox / Cloudflare Pages 对旧 index.html 的 HTTP/Memory 强缓存
    const urlObj = new URL(currentPath, window.location.origin)
    urlObj.searchParams.set('_cc_refresh', String(now))

    window.location.replace(urlObj.toString())
  } catch (e) {
    reportError(e, 'Failed to trigger chunk recovery reload')
    window.location.reload()
  }
}

export function installChunkLoadRecovery(router: Router) {
  // 初始化时清理 URL 中的 _cc_refresh 参数
  cleanupRefreshParam()

  // 1. Vue Router 路由加载错误捕获
  router.onError((error, to) => {
    reportError(error, '路由或Chunk资源加载失败')
    if (isChunkLoadError(error)) {
      triggerRecoveryReload(window.location.origin + to.fullPath)
    }
  })

  router.afterEach(() => {
    try {
      cleanupRefreshParam()
      // 成功完成路由导航 15 秒后清除刷新计时锁
      const lastTime = parseInt(sessionStorage.getItem(recoveryTimeKey) || '0', 10)
      if (Date.now() - lastTime > 15000) {
        sessionStorage.removeItem(recoveryTimeKey)
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
      triggerRecoveryReload()
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
        triggerRecoveryReload()
      }
    },
    true
  )
}
