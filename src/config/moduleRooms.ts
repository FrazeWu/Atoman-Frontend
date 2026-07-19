export type ModuleRoomKey =
  | 'feed'
  | 'music'
  | 'blog'
  | 'forum'
  | 'debate'
  | 'timeline'
  | 'podcast'
  | 'video'

import type { SiteContext } from '@/router/siteContext'

export type ModuleRoom = {
  key: ModuleRoomKey
  homePath: '/'
  publicPathSegment: string
  name: string
  helper: string
  homepageSub: string
}

export const moduleRooms: Record<ModuleRoomKey, ModuleRoom> = {
  feed: {
    key: 'feed',
    homePath: '/',
    publicPathSegment: 'feed',
    name: '订阅',
    helper: 'RSS 与更新流',
    homepageSub: '聚合你感兴趣的 RSS 订阅源与内容更新。',
  },
  music: {
    key: 'music',
    homePath: '/',
    publicPathSegment: 'music',
    name: '音乐',
    helper: '音乐档案',
    homepageSub: '整理专辑、歌曲与艺人资料。',
  },
  blog: {
    key: 'blog',
    homePath: '/',
    publicPathSegment: 'posts',
    name: '博客',
    helper: '内容视图',
    homepageSub: '',
  },
  forum: {
    key: 'forum',
    homePath: '/',
    publicPathSegment: 'forum',
    name: '论坛',
    helper: '讨论与发帖',
    homepageSub: '坐下来发帖、回复、搜索和闲谈。',
  },
  debate: {
    key: 'debate',
    homePath: '/',
    publicPathSegment: 'debate',
    name: '辩论',
    helper: '辩题讨论',
    homepageSub: '',
  },
  timeline: {
    key: 'timeline',
    homePath: '/',
    publicPathSegment: 'timeline',
    name: '时间线',
    helper: '人物时间线',
    homepageSub: '记录人物与事件，查看时间脉络和地图。',
  },
  podcast: {
    key: 'podcast',
    homePath: '/',
    publicPathSegment: 'podcasts',
    name: '播客',
    helper: '内容视图',
    homepageSub: '',
  },
  video: {
    key: 'video',
    homePath: '/',
    publicPathSegment: 'videos',
    name: '视频',
    helper: '内容视图',
    homepageSub: '',
  },
}

export const moduleNavOrder: ModuleRoomKey[] = [
  'feed',
  'blog',
  'music',
  'forum',
  'debate',
  'timeline',
  'podcast',
  'video',
]

export const topbarNavOrder: ModuleRoomKey[] = [
  'feed',
  'blog',
  'music',
  'video',
  'podcast',
  'forum',
  'debate',
  'timeline',
]

export const isRoomRouteActive = (key: ModuleRoomKey, context: SiteContext) => (
  context.type === 'module' && context.module === key
)

export const notificationRoom = {
  name: '通知',
  helper: '通知与提醒',
  homepageSub: '通知与私信统一收纳在这里。',
} as const

export const footbarLinks = [
  { label: '关于', panel: 'about', group: 'primary' },
  { label: '联系我们', panel: 'contact', group: 'primary' },
  { label: '问题反馈', panel: 'feedback', group: 'primary' },
  { label: '使用条款', panel: 'terms', group: 'secondary' },
  { label: '隐私政策', panel: 'privacy', group: 'secondary' },
] as const

export type FootbarPanel = typeof footbarLinks[number]['panel']
