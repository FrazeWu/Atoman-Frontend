const mobileDetailPatterns = [
  /^\/feed\/item\//,
  /^\/(?:post|posts\/(?:post|notes|channel)|channel|channels|collection|users)\//,
  /^\/music\/(?:tags|artist|album|song|playlist)\//,
  /^\/music\/(?:player|lyrics)$/,
  /^\/videos\/watch\//,
  /^\/videos\/collections\//,
  /^\/podcasts\/(?:show|episode)\//,
  /^\/books\/(?:work|edition|read|public-read|import)\//,
  /^\/forum\/(?:topic\/|new$)/,
  /^\/timeline\/person\//,
  /^\/debate\/(?!search(?:\/|$)|me(?:\/|$)|rules(?:\/|$))[^/]+/,
]

export function isMobileDetailRoute(path: string) {
  path = path.split(/[?#]/)[0] || '/'
  if (/^\/users\/[^/]+\/settings(?:\/|$)/.test(path)) return false
  return mobileDetailPatterns.some((pattern) => pattern.test(path))
}
