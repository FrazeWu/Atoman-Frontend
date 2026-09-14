type BundleEntry = {
  type: 'asset'
  source: string | Uint8Array
} | {
  type: 'chunk'
}

type BuildBundle = Record<string, BundleEntry>

export function deferStylesheetLinks(html: string) {
  return html.replace(/<link\b[^>]*\brel=(['"])stylesheet\1[^>]*>/gi, (tag) => {
    if (!/\bhref=/i.test(tag)) return tag

    const preload = tag
      .replace(/\brel=(['"])stylesheet\1/i, 'rel="preload" as="style"')
      .replace(/\s*\/?\s*>$/, ' onload="this.onload=null;this.rel=\'stylesheet\'">')

    return `${preload}<noscript>${tag}</noscript>`
  })
}

export function deferInitialStylesheetPlugin() {
  return {
    name: 'defer-initial-stylesheet',
    apply: 'build' as const,
    enforce: 'post' as const,
    generateBundle(_options: unknown, bundle: BuildBundle) {
      const index = bundle['index.html']
      if (!index || index.type !== 'asset' || index.source === undefined) return

      const html = typeof index.source === 'string'
        ? index.source
        : new TextDecoder().decode(index.source)
      index.source = deferStylesheetLinks(html)
    },
  }
}
