const staleChunkReloadKey = 'atoman:stale-vite-chunk-reload'
const staleChunkReloadWindowMs = 15_000
let installed = false

export function installStaleViteChunkRecovery() {
  if (installed) return
  installed = true

  window.addEventListener('vite:preloadError', (event) => {
    const now = Date.now()
    const previousAttempt = Number(sessionStorage.getItem(staleChunkReloadKey) ?? 0)

    if (now - previousAttempt < staleChunkReloadWindowMs) return

    sessionStorage.setItem(staleChunkReloadKey, String(now))
    event.preventDefault()
    window.location.reload()
  })
}
