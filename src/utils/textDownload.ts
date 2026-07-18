export function sanitizeDownloadName(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    || 'lyrics'
}

export function downloadTextFile(baseName: string, content: string, suffix: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${sanitizeDownloadName(baseName)}${suffix}`
    anchor.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
