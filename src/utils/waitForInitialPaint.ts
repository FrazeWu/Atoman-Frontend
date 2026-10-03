export function waitForInitialPaint(): Promise<void> {
  if (typeof document === 'undefined' || !document.documentElement.hasAttribute('data-portal-prerender')) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}
