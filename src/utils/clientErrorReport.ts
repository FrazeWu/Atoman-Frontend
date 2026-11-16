import type { Router } from 'vue-router'

import { useApiUrl } from '@/composables/useApiUrl'
import { appVersion } from '@/config/appVersion'
import { isChunkLoadError } from '@/router/chunkLoadRecovery'
import { configureErrorReporter } from '@/utils/logger'

export type ClientErrorKind = 'window' | 'unhandledrejection' | 'vue' | 'chunk'

export interface ClientErrorReport {
  release: string
  route: string
  kind: ClientErrorKind
  name: string
  message: string
  stack: string
  context: string
  user_agent: string
}

const DEDUPE_MS = 10 * 60 * 1000
const RATE_WINDOW_MS = 60 * 1000
const RATE_LIMIT = 12
const MAX_BODY_BYTES = 6000

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const bearerPattern = /bearer\s+[A-Z0-9._~+/-]+=*/gi
const jwtPattern = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g
const fragmentSecretPattern = /#(?:access_token|id_token|refresh_token|token|code)=[^\s]*/gi
const queryPattern = /\?[^\s#]*/g
const secretParamPattern = /\b(access_token|refresh_token|id_token|token|auth|api_key|apikey|secret|password|passwd|email|signature|sig|jwt)=([^\s&]+)/gi
const releasePattern = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/
const uuidPattern = /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/gi
const numericSegmentPattern = /\/\d+(?=\/|$)/g

function initialRoute() {
  if (typeof window === 'undefined') return '/'
  return redactConcretePath(window.location.pathname || '/')
}

let currentRoute = initialRoute()
let unloading = false
let unloadListenerInstalled = false

export function sanitizeClientErrorText(value: string) {
  return value
    .replace(emailPattern, '[redacted]')
    .replace(bearerPattern, 'Bearer [redacted]')
    .replace(jwtPattern, '[redacted]')
    .replace(fragmentSecretPattern, '')
    .replace(queryPattern, '')
    .replace(secretParamPattern, '$1=[redacted]')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

export function sanitizeClientErrorRoute(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  let path = trimmed
  if (path.includes('://')) {
    try {
      path = new URL(path).pathname
    } catch {
      return ''
    }
  }
  const cut = path.search(/[?#]/)
  if (cut >= 0) path = path.slice(0, cut)
  path = sanitizeClientErrorText(path)
  if (!path.startsWith('/') || path.includes('[redacted]') || /[\s@\\]/.test(path)) return ''
  return path.slice(0, 256)
}

export function redactConcretePath(path: string) {
  const sanitized = sanitizeClientErrorRoute(path)
  if (!sanitized) return '/'
  return sanitized.replace(uuidPattern, '/:id').replace(numericSegmentPattern, '/:id')
}

export function routePatternFromRoute(to: { matched: readonly { path: string }[]; path: string }) {
  for (let index = to.matched.length - 1; index >= 0; index -= 1) {
    const pattern = sanitizeClientErrorRoute(to.matched[index]?.path || '')
    if (pattern) return pattern
  }
  return redactConcretePath(to.path)
}

export function setClientErrorRoute(route: string) {
  const sanitized = sanitizeClientErrorRoute(route) || redactConcretePath(route)
  if (sanitized) currentRoute = sanitized
}

export function currentClientErrorRoute() {
  return currentRoute
}

export function installClientErrorRouteTracking(router: Router) {
  const sync = () => setClientErrorRoute(routePatternFromRoute(router.currentRoute.value))
  router.afterEach(sync)
  sync()
}

function isStaticAssetContext(context: string | undefined) {
  return Boolean(context && (context.includes('静态资源') || context.includes('Chunk 资源')))
}

export function classifyClientError(context: string | undefined, error: unknown): ClientErrorKind | null {
  if (isChunkLoadError(error) || isChunkLoadError(context) || isStaticAssetContext(context)) return 'chunk'
  if (context?.startsWith('Vue')) return 'vue'
  if (context === '未处理 Promise 异常') return 'unhandledrejection'
  if (
    context === '未处理运行时错误' ||
    context === '应用启动失败' ||
    context === '路由加载失败' ||
    context === '移动端路由加载失败' ||
    context === '路由或Chunk资源加载失败'
  ) {
    return 'window'
  }
  return null
}

function errorParts(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name || 'Error', message: error.message || '', stack: error.stack || '' }
  }
  if (typeof error === 'string') return { name: 'Error', message: error, stack: '' }
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return { name: 'Error', message: error.message, stack: '' }
  }
  return { name: 'Error', message: 'Unexpected error', stack: '' }
}

function clip(value: string, max: number) {
  return value.length <= max ? value : value.slice(0, max)
}

function releaseValue(release: string) {
  const trimmed = clip(release.trim(), 64)
  return releasePattern.test(trimmed) ? trimmed : 'unknown'
}

export function buildClientErrorReport(error: unknown, context: string | undefined, release = appVersion, userAgent = navigator.userAgent): ClientErrorReport | null {
  const kind = classifyClientError(context, error)
  if (!kind) return null
  const parts = errorParts(error)
  const stack = clip(sanitizeClientErrorText(parts.stack).split('\n').slice(0, 12).join('\n'), 1500)
  return {
    release: releaseValue(release),
    route: currentRoute || '/',
    kind,
    name: clip(sanitizeClientErrorText(parts.name), 128) || 'Error',
    message: clip(sanitizeClientErrorText(parts.message), 400),
    stack,
    context: clip(sanitizeClientErrorText(context || ''), 160),
    user_agent: clip(sanitizeClientErrorText(userAgent || ''), 180),
  }
}

interface ClientErrorReporterDeps {
  endpoint?: () => string
  now?: () => number
  fetchImpl?: typeof fetch
  beacon?: (url: string, body: Blob) => boolean
  unloading?: () => boolean
  rateLimit?: number
  dedupeMs?: number
}

export function createClientErrorReporter(deps: ClientErrorReporterDeps = {}) {
  const now = deps.now ?? (() => Date.now())
  const rateLimit = deps.rateLimit ?? RATE_LIMIT
  const dedupeMs = deps.dedupeMs ?? DEDUPE_MS
  const fetchImpl = deps.fetchImpl ?? fetch
  const endpoint = deps.endpoint ?? (() => `${useApiUrl()}/client-errors`)
  const beacon = deps.beacon
  const isUnloading = deps.unloading ?? (() => unloading || document.visibilityState === 'hidden')
  const seen = new Map<string, number>()
  const hits: number[] = []
  let disabled = false
  let ready = false
  let chain = Promise.resolve()

  const allow = (fingerprint: string, timestamp: number) => {
    const previous = seen.get(fingerprint)
    if (previous !== undefined && timestamp - previous < dedupeMs) return false
    while (hits.length > 0 && timestamp - hits[0] >= RATE_WINDOW_MS) hits.shift()
    if (hits.length >= rateLimit) return false
    hits.push(timestamp)
    seen.set(fingerprint, timestamp)
    if (seen.size > 200) {
      const oldest = seen.keys().next().value
      if (oldest) seen.delete(oldest)
    }
    return true
  }

  const deliver = async (body: string) => {
    if (disabled) return
    const url = endpoint()
    if (ready && isUnloading() && beacon) {
      try {
        if (beacon(url, new Blob([body], { type: 'text/plain;charset=UTF-8' }))) return
      } catch {
        // Fall through to fetch when the beacon queue rejects the payload.
      }
    }
    let response: Response
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        credentials: 'omit',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body,
      })
    } catch {
      return
    }
    if (response.status === 404) {
      disabled = true
      return
    }
    if (response.ok) ready = true
  }

  return {
    report(error: unknown, context?: string) {
      const payload = buildClientErrorReport(error, context)
      if (!payload || disabled) return Promise.resolve()
      const fingerprint = [payload.release, payload.route, payload.kind, payload.name, payload.message].join('\n')
      if (!allow(fingerprint, now())) return Promise.resolve()
      let body = JSON.stringify(payload)
      if (body.length > MAX_BODY_BYTES) {
        payload.stack = ''
        body = JSON.stringify(payload)
      }
      chain = chain.then(() => deliver(body)).catch(() => undefined)
      return chain
    },
  }
}

function installUnloadListener() {
  if (unloadListenerInstalled || typeof window === 'undefined') return
  unloadListenerInstalled = true
  window.addEventListener('pagehide', () => {
    unloading = true
  })
  window.addEventListener('pageshow', () => {
    unloading = false
  })
}

let productionReporter: ReturnType<typeof createClientErrorReporter> | null = null

export function installProductionErrorReporting() {
  if (!import.meta.env.PROD || typeof window === 'undefined' || productionReporter) return
  installUnloadListener()
  productionReporter = createClientErrorReporter({
    beacon: (url, body) => navigator.sendBeacon?.(url, body) === true,
  })
  configureErrorReporter((error, context) => {
    void productionReporter?.report(error, context)
  })
}
