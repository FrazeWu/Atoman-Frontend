export type ModuleRoomKey =
  | 'feed'
  | 'kanbo'
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
  name: string
  helper: string
  homepageSub: string
}

export const moduleRooms: Record<ModuleRoomKey, ModuleRoom> = {
  feed: {
    key: 'feed',
    homePath: '/',
    name: '订阅',
    helper: 'RSS 与更新流',
    homepageSub: '聚合你感兴趣的 RSS 订阅源与内容更新。',
  },
  kanbo: {
    key: 'kanbo',
    homePath: '/',
    name: '内容',
    helper: '文章、播客、视频',
    homepageSub: '统一管理频道内的文章、播客与视频创作。',
  },
  music: {
    key: 'music',
    homePath: '/',
    name: '音乐',
    helper: '音乐档案',
    homepageSub: '整理专辑、歌曲与艺人资料。',
  },
  blog: {
    key: 'blog',
    homePath: '/',
    name: '文章',
    helper: '内容视图',
    homepageSub: '查看当前频道下的文章内容。',
  },
  forum: {
    key: 'forum',
    homePath: '/',
    name: '论坛',
    helper: '讨论与发帖',
    homepageSub: '坐下来发帖、回复、搜索和闲谈。',
  },
  debate: {
    key: 'debate',
    homePath: '/',
    name: '辩论',
    helper: '辩题讨论',
    homepageSub: '围绕辩题展开立场、论点与正反讨论。',
  },
  timeline: {
    key: 'timeline',
    homePath: '/',
    name: '时间线',
    helper: '人物时间线',
    homepageSub: '记录人物与事件，查看时间脉络和地图。',
  },
  podcast: {
    key: 'podcast',
    homePath: '/',
    name: '播客',
    helper: '内容视图',
    homepageSub: '查看当前频道下的播客内容。',
  },
  video: {
    key: 'video',
    homePath: '/',
    name: '视频',
    helper: '内容视图',
    homepageSub: '查看当前频道下的视频内容。',
  },
}

export const moduleNavOrder: ModuleRoomKey[] = [
  'feed',
  'kanbo',
  'music',
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
  { label: '关于', href: '/about' },
  { label: '联系我们', href: 'mailto:hello@atoman.org' },
  { label: '提交 Issue', href: 'https://github.com/FrazeWu/Atoman/issues' },
  { label: '使用条款', href: '/terms' },
  { label: '隐私政策', href: '/privacy' },
] as const
