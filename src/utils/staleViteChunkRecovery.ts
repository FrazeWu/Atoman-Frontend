const staleChunkReloadKey = 'atoman:stale-vite-chunk-reload'
const staleChunkReloadWindowMs = 15_000
const staleChunkErrorPattern = /Failed to fetch dynamically imported module|Importing a module script failed|Expected a JavaScript-or-Wasm module script|Unable to preload CSS/i
let installed = false

function reloadOnce() {
  const now = Date.now()
  const previousAttempt = Number(sessionStorage.getItem(staleChunkReloadKey) ?? 0)

  if (now - previousAttempt < staleChunkReloadWindowMs) return false

  sessionStorage.setItem(staleChunkReloadKey, String(now))
  window.location.reload()
  return true
}

export function recoverStaleViteChunk(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (!staleChunkErrorPattern.test(message)) return false
  return reloadOnce()
}

export function installStaleViteChunkRecovery() {
  if (installed) return
  installed = true

  window.addEventListener('vite:preloadError', (event) => {
    if (reloadOnce()) event.preventDefault()
  })
}
