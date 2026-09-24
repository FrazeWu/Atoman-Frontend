const GOOGLE_ANALYTICS_ID = 'G-1FLNTZ469W'
const ANALYTICS_DELAY_MS = 10000

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

let analyticsLoadPromise: Promise<void> | null = null

export function loadGoogleAnalytics() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.resolve()
  if (analyticsLoadPromise) return analyticsLoadPromise

  analyticsLoadPromise = new Promise((resolve) => {
    const dataLayer = window.dataLayer || []
    window.dataLayer = dataLayer
    window.gtag = (...args: unknown[]) => dataLayer.push(args)
    window.gtag('js', new Date())
    window.gtag('config', GOOGLE_ANALYTICS_ID)

    if (document.querySelector('script[data-atoman-analytics]')) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.async = true
    script.dataset.atomanAnalytics = 'true'
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`
    script.onload = () => resolve()
    script.onerror = () => resolve()
    document.head.appendChild(script)
  })

  return analyticsLoadPromise
}

export function scheduleGoogleAnalytics(onReady?: () => void) {
  if (typeof window === 'undefined') return

  const load = () => {
    void loadGoogleAnalytics().then(() => onReady?.())
  }

  globalThis.setTimeout(load, ANALYTICS_DELAY_MS)
}
