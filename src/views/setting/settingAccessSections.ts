import type { ModuleRoomKey } from '@/config/moduleRooms'

export type SectionPosition = {
  key: ModuleRoomKey
  top: number
}

export function getSectionDomId(key: ModuleRoomKey) {
  return `module-${key}`
}

export function resolveInitialSettingSection(hash: string) {
  const key = hash.replace(/^#module-/, '') as ModuleRoomKey
  return hash.startsWith('#module-') && key ? key : null
}

export function resolveActiveSectionByScroll(
  positions: SectionPosition[],
  scrollY: number,
  viewportOffset = 280,
) {
  if (!positions.length) return null

  const anchor = scrollY + viewportOffset
  let active = positions[0].key

  for (const position of positions) {
    if (position.top <= anchor) {
      active = position.key
      continue
    }
    break
  }

  return active
}
