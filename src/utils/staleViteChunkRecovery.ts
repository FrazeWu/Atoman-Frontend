const staleChunkReloadKey = 'atoman:stale-vite-chunk-reload'
const staleChunkReloadWindowMs = 15_000

const staleChunkErrorPattern = new RegExp([
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
  'unable to preload css',
  'disallowed mime type',
  'mime type',
  'failed to load module script',
  'loading failed for the module',
  'loading module from',
  'networkerror when attempting to fetch resource',
  'fetch dynamically imported module',
  'loading chunk',
  'dynamically imported module',
  'expected a javascript-or-wasm module script',
].join('|'), 'i')

let installed = false

function reloadOnce() {
  const now = Date.now()
  const previousAttempt = Number(sessionStorage.getItem(staleChunkReloadKey) ?? 0)

  if (now - previousAttempt < staleChunkReloadWindowMs) return false

  sessionStorage.setItem(staleChunkReloadKey, String(now))
  try {
    const urlObj = new URL(window.location.href)
    urlObj.searchParams.set('_cc_refresh', String(now))
    window.location.replace(urlObj.toString())
  } catch {
    window.location.reload()
  }
  return true
}

export function recoverStaleViteChunk(error: unknown) {
  if (!error) return false
  const message = error instanceof Error ? error.message : String(error ?? '')
  const stack = error instanceof Error ? (error.stack || '') : ''
  if (!staleChunkErrorPattern.test(message) && !staleChunkErrorPattern.test(stack)) return false
  return reloadOnce()
}

export function installStaleViteChunkRecovery() {
  if (installed) return
  installed = true

  window.addEventListener('vite:preloadError', (event) => {
    if (reloadOnce()) event.preventDefault()
  })
}
