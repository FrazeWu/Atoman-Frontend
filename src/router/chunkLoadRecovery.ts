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

    // 构造带时间戳的强刷 URL，彻底打穿 Firefox 对旧 index.html 的 HTTP/Memory 强缓存
    const urlObj = new URL(currentPath, window.location.origin)
    urlObj.searchParams.set('_cc_refresh', String(now))

    window.location.replace(urlObj.toString())
  } catch (e) {
    reportError(e, 'Failed to trigger chunk recovery reload')
    window.location.reload()
  }
}

export function installChunkLoadRecovery(router: Router) {
  // 1. Vue Router 路由加载错误捕获
  router.onError((error, to) => {
    reportError(error, '路由或Chunk资源加载失败')
    if (isChunkLoadError(error)) {
      triggerRecoveryReload(window.location.origin + to.fullPath)
    }
  })

  router.afterEach(() => {
    try {
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

  // 3. 全局 Resource Error 监听（捕获 SCRIPT / LINK 静态文件加载 404 或 MIME 拦截）
  window.addEventListener(
    'error',
    (event) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
        const src = (target as HTMLScriptElement).src || (target as HTMLLinkElement).href
        if (src && (src.includes('/assets/') || src.includes('.js') || src.includes('.css'))) {
          reportError(event.error || event.message, `静态资源加载错误: ${src}`)
          triggerRecoveryReload()
        }
      }
    },
    true
  )
}
