import { moduleNavOrder, moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'

export type ModuleFeatureKey =
  | 'subscription.manage'
  | 'music.submit'
  | 'music.review'
  | 'post.create'
  | 'channel.manage'
  | 'topic.create'
  | 'category.request'
  | 'debate.create'
  | 'argument.create'
  | 'timeline.edit'
  | 'podcast.publish'
  | 'video.publish'

export type FeedFullTextMode = 'disabled' | 'per_source'
export type BlogCommentMode = 'all' | 'authenticated' | 'disabled'

export type ModuleAccess = {
  enabled: boolean
  features: Partial<Record<ModuleFeatureKey, boolean>>
}

export type SiteAccessSettings = {
  feed: {
    allow_manage_sources: boolean
    allow_add_source: boolean
    full_text_mode: FeedFullTextMode
  }
  blog: {
    comment_mode: BlogCommentMode
  }
  forum: {
    allow_category_request: boolean
    moderator_permissions: {
      review_category_request: boolean
      pin_topic: boolean
      lock_topic: boolean
    }
  }
}

export type SiteAccess = {
  version: 1
  modules: Record<ModuleRoomKey, ModuleAccess>
  settings: SiteAccessSettings
}

type LegacyModuleAccessInput = Partial<ModuleAccess> & {
  visible?: boolean
}

type SiteAccessSettingsInput = Partial<{
  feed: Partial<SiteAccessSettings['feed']> & Partial<{
    allow_manage_sources: boolean
    allow_add_source: boolean
  }>
  blog: Partial<SiteAccessSettings['blog']>
  forum: Partial<{
    allow_category_request: boolean
    moderator_permissions: Partial<SiteAccessSettings['forum']['moderator_permissions']>
  }>
}>

export type SiteAccessInput = {
  version?: number
  modules?: Partial<Record<ModuleRoomKey, LegacyModuleAccessInput>>
  settings?: SiteAccessSettingsInput
} | null | undefined

export const siteAccessFeatures: Partial<Record<ModuleRoomKey, { key: ModuleFeatureKey; label: string }[]>> = {
  feed: [
    { key: 'subscription.manage', label: '订阅管理' },
  ],
  media: [],
  music: [
    { key: 'music.submit', label: '提交音乐资料' },
    { key: 'music.review', label: '音乐审核' },
  ],
  blog: [
    { key: 'post.create', label: '写文章' },
    { key: 'channel.manage', label: '频道与合集管理' },
  ],
  forum: [
    { key: 'topic.create', label: '发新话题' },
    { key: 'category.request', label: '申请分类' },
  ],
  debate: [
    { key: 'debate.create', label: '创建辩题' },
    { key: 'argument.create', label: '发表论点' },
  ],
  timeline: [
    { key: 'timeline.edit', label: '编辑时间线' },
  ],
  podcast: [
    { key: 'podcast.publish', label: '发布播客' },
  ],
  video: [
    { key: 'video.publish', label: '上传视频' },
  ],
}

const buildDefaultModules = (): Record<ModuleRoomKey, ModuleAccess> => {
  const modules = {} as Record<ModuleRoomKey, ModuleAccess>

  for (const key of Object.keys(moduleRooms) as ModuleRoomKey[]) {
    const features: Partial<Record<ModuleFeatureKey, boolean>> = {}
    for (const feature of siteAccessFeatures[key] ?? []) {
      features[feature.key] = true
    }
    modules[key] = { enabled: true, features }
  }

  return modules
}

const buildDefaultSettings = (): SiteAccessSettings => ({
  feed: {
    allow_manage_sources: true,
    allow_add_source: true,
    full_text_mode: 'per_source',
  },
  blog: {
    comment_mode: 'authenticated',
  },
  forum: {
    allow_category_request: true,
    moderator_permissions: {
      review_category_request: true,
      pin_topic: true,
      lock_topic: true,
    },
  },
})

export const defaultSiteAccess: SiteAccess = {
  version: 1,
  modules: buildDefaultModules(),
  settings: buildDefaultSettings(),
}

export function mergeSiteAccess(input: SiteAccessInput): SiteAccess {
  const modules = buildDefaultModules()
  const settings = buildDefaultSettings()

  for (const key of Object.keys(moduleRooms) as ModuleRoomKey[]) {
    const partial = input?.modules?.[key]
    if (!partial) continue

    modules[key] = {
      enabled: partial.enabled ?? partial.visible ?? modules[key].enabled,
      features: {
        ...modules[key].features,
        ...(partial.features ?? {}),
      },
    }
  }

  if (input?.settings?.feed) {
    settings.feed = {
      ...settings.feed,
      ...input.settings.feed,
    }
  }
  if (input?.settings?.blog) {
    settings.blog = {
      ...settings.blog,
      ...input.settings.blog,
    }
  }
  if (input?.settings?.forum) {
    settings.forum = {
      ...settings.forum,
      ...input.settings.forum,
      moderator_permissions: {
        ...settings.forum.moderator_permissions,
        ...(input.settings.forum.moderator_permissions ?? {}),
      },
    }
  }

  if (input?.settings?.forum?.allow_category_request !== undefined) {
    settings.forum.allow_category_request = input.settings.forum.allow_category_request
    modules.forum.features['category.request'] = input.settings.forum.allow_category_request
  } else if (input?.modules?.forum?.features?.['category.request'] !== undefined) {
    settings.forum.allow_category_request = input.modules.forum.features['category.request']
    modules.forum.features['category.request'] = input.modules.forum.features['category.request']
  } else {
    modules.forum.features['category.request'] = settings.forum.allow_category_request
  }

  return { version: 1, modules, settings }
}

export function getVisibleModuleKeys(access: SiteAccess): ModuleRoomKey[] {
  return moduleNavOrder.filter((key) => access.modules[key].enabled)
}

export function isModuleVisible(access: SiteAccess, module: ModuleRoomKey): boolean {
  return access.modules[module]?.enabled ?? true
}

export function isModuleFeatureEnabled(access: SiteAccess, module: ModuleRoomKey, feature: ModuleFeatureKey): boolean {
  if (!isModuleVisible(access, module)) return false
  return access.modules[module]?.features?.[feature] ?? true
}

export function getBlogCommentMode(access: SiteAccess): BlogCommentMode {
  return access.settings.blog.comment_mode
}

export function getFeedFullTextMode(access: SiteAccess): FeedFullTextMode {
  return access.settings.feed.full_text_mode
}

export function isForumCategoryRequestEnabled(access: SiteAccess): boolean {
  return access.settings.forum.allow_category_request
}
