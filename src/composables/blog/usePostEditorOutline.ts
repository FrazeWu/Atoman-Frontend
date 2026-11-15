import { getCurrentScope, onScopeDispose, ref, watch, type Ref } from 'vue'

export interface PostOutlineHeading {
  id: string
  level: 1 | 2 | 3 | 4 | 5 | 6
  text: string
  lineNumber: number
}

export function extractMarkdownHeadings(content: string): PostOutlineHeading[] {
  if (!content) return []
  const lines = content.split('\n')
  const headings: PostOutlineHeading[] = []
  let fenceCharacter = ''
  let fenceLength = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const fenceMatch = /^(```+|~~~+)/.exec(trimmed)

    // 忽略围栏代码块内部的标题
    if (fenceMatch) {
      const marker = fenceMatch[1]
      const markerCharacter = marker[0]
      if (!fenceCharacter) {
        fenceCharacter = markerCharacter
        fenceLength = marker.length
      } else if (markerCharacter === fenceCharacter && marker.length >= fenceLength) {
        fenceCharacter = ''
        fenceLength = 0
      }
      continue
    }
    if (fenceCharacter) continue

    // 匹配 Markdown 标题：# 到 ######
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      const level = match[1].length as PostOutlineHeading['level']
      const text = match[2].trim().replace(/\s+#+$/, '')
      if (text) {
        headings.push({
          id: `h-${i + 1}-${level}`,
          level,
          text,
          lineNumber: i + 1,
        })
      }
    }
  }

  return headings
}

export function usePostEditorOutline(contentRef: Ref<string>) {
  const headings = ref<PostOutlineHeading[]>(extractMarkdownHeadings(contentRef.value))

  let timer: ReturnType<typeof setTimeout> | null = null

  watch(contentRef, (newContent) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      headings.value = extractMarkdownHeadings(newContent)
    }, 150)
  })

  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (timer) clearTimeout(timer)
      timer = null
    })
  }

  return {
    headings,
    extractMarkdownHeadings,
  }
}
