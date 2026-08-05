import type { Router } from 'vue-router'
import { reportError } from '@/utils/logger'

const recoveryStorageKey = 'atoman_chunk_load_recovery'
const chunkLoadErrorPattern = /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|unable to preload css/i

export function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return chunkLoadErrorPattern.test(message)
}

export function installChunkLoadRecovery(router: Router) {
  router.onError((error, to) => {
    reportError(error, '路由加载失败')
    if (!isChunkLoadError(error)) return

    const target = to.fullPath
    try {
      if (sessionStorage.getItem(recoveryStorageKey) === target) return
      sessionStorage.setItem(recoveryStorageKey, target)
    } catch {
      // Storage may be unavailable in restricted browsing modes; navigation can still recover.
    }

    window.location.assign(target)
  })

  router.afterEach((_to, _from, failure) => {
    if (failure) return
    try {
      sessionStorage.removeItem(recoveryStorageKey)
    } catch {
      // Nothing to clear when storage is unavailable.
    }
  })
}
