export interface TextPage {
  content: string
  start: number
  end: number
}

type FitsPage = (content: string) => boolean

const DEFAULT_PAGE_LENGTH = 2_400

function findPreferredBreak(text: string, start: number, end: number) {
  const minimum = start + Math.floor((end - start) * 0.5)
  const paragraphBreak = text.lastIndexOf('\n\n', end - 1)
  if (paragraphBreak >= minimum) return paragraphBreak + 2

  const lineBreak = text.lastIndexOf('\n', end - 1)
  if (lineBreak >= minimum) return lineBreak + 1

  const spaceBreak = text.lastIndexOf(' ', end - 1)
  if (spaceBreak >= minimum) return spaceBreak + 1

  return end
}

function findFittingEnd(text: string, start: number, fits: FitsPage) {
  if (fits(text.slice(start))) return text.length

  let low = start + 1
  let high = text.length
  let result = start
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (fits(text.slice(start, middle))) {
      result = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return result
}

export function paginateText(text: string, fits?: FitsPage, fallbackLength = DEFAULT_PAGE_LENGTH): TextPage[] {
  if (!text) return []

  const pages: TextPage[] = []
  let start = 0
  while (start < text.length) {
    const measuredEnd = fits ? findFittingEnd(text, start, fits) : Math.min(text.length, start + fallbackLength)
    const end = Math.max(start + 1, findPreferredBreak(text, start, measuredEnd))
    pages.push({ content: text.slice(start, end), start, end })
    start = end
  }
  return pages
}
