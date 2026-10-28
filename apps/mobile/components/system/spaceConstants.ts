export interface SpaceDefinition {
  key: string
  name: string
  icon: string
  badge?: string
  path: string
}

export const ATOMAN_SPACES: SpaceDefinition[] = [
  { key: 'global', name: '首页', icon: 'compass', path: '/' },
  { key: 'feed', name: 'Feed', icon: 'feed', badge: 'RSS', path: '/feed' },
  { key: 'music', name: '音乐', icon: 'music', badge: 'Hi-Res', path: '/music' },
  { key: 'podcast', name: '播客', icon: 'mic', path: '/podcasts' },
  { key: 'video', name: '视频', icon: 'play', path: '/videos' },
  { key: 'forum', name: '论坛', icon: 'messages', path: '/forum' },
  { key: 'timeline', name: '时间线', icon: 'clock', path: '/timeline' },
  { key: 'books', name: '阅读', icon: 'books', badge: 'EPUB', path: '/books' },
  { key: 'blog', name: '博客', icon: 'blog', path: '/posts' },
  { key: 'debate', name: '辩论', icon: 'debate', path: '/debate' },
  { key: 'messages', name: '消息', icon: 'messages', path: '/inbox' },
  { key: 'studio', name: 'Studio', icon: 'studio', path: '/studio' },
]

export const SPACE_LABELS: Record<string, string> = {
  global: 'Atoman',
  podcast: '播客',
  video: '视频',
  forum: '论坛',
  timeline: '时间线',
  feed: 'Feed',
  music: '音乐',
  books: '阅读',
  blog: '博客',
  debate: '辩论',
  messages: '消息',
  studio: 'Studio',
  me: '个人中心',
}

export const SPACE_PATHS: Record<string, string> = {
  global: '/',
  podcast: '/podcasts',
  video: '/videos',
  forum: '/forum',
  timeline: '/timeline',
  feed: '/feed',
  music: '/music',
  books: '/books',
  blog: '/posts',
  debate: '/debate',
  messages: '/inbox',
  studio: '/studio',
}

export type { NavTabItem } from './bottomNavConstants'
export { SPACE_TABS } from './bottomNavConstants'
