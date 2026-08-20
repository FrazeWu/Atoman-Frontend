export function hasFeedReaderImage(html: string): boolean {
  if (!html.trim() || typeof DOMParser === 'undefined') return false
  const document = new DOMParser().parseFromString(html, 'text/html')
  return Boolean(document.querySelector('img[src], img[data-src], img[data-original], img[data-lazy-src]'))
}
