const mobileDetailPatterns = [
  /^\/feed\/item\//,
  /^\/(?:post|posts\/(?:post|notes|channel)|channel|channels|collection|users)\//,
  /^\/music\/(?:tags|artist|album|song|playlist)\//,
  /^\/music\/(?:player|lyrics)$/,
  /^\/videos\/watch\//,
]

export function isMobileDetailRoute(path: string) {
  if (/^\/users\/[^/]+\/settings(?:\/|$)/.test(path)) return false
  return mobileDetailPatterns.some((pattern) => pattern.test(path))
}
