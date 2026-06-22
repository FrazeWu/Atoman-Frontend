import { modulePathUrl, moduleUrl } from '@/composables/useSubdomainNav'
import type { ModuleRoomKey } from '@/config/moduleRooms'

export type MobilePrimaryTabKey = 'discover' | 'feed' | 'create' | 'more'

export type MobilePrimaryTab = {
  key: MobilePrimaryTabKey
  label: string
  module?: ModuleRoomKey
  href?: string
}

export type MobileMoreItem = {
  module: ModuleRoomKey
  label: string
  href: string
}

const PRIMARY_TABS: MobilePrimaryTab[] = [
  { key: 'discover', label: '首页/发现', module: 'media', href: moduleUrl('media') },
  { key: 'feed', label: '订阅', module: 'feed', href: moduleUrl('feed') },
  { key: 'create', label: '创作/内容', module: 'media', href: modulePathUrl('media', '/create') },
  { key: 'more', label: '更多' },
]

const MORE_ITEMS: MobileMoreItem[] = [
  { module: 'music', label: '音乐', href: moduleUrl('music') },
  { module: 'forum', label: '论坛', href: moduleUrl('forum') },
  { module: 'debate', label: '辩论', href: moduleUrl('debate') },
  { module: 'timeline', label: '时间线', href: moduleUrl('timeline') },
]

export const getMobilePrimaryTabs = (): MobilePrimaryTab[] => PRIMARY_TABS.map((tab) => ({ ...tab }))

export const getMobileMoreItems = (): MobileMoreItem[] => MORE_ITEMS.map((item) => ({ ...item }))
