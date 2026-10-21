export interface SpaceDefinition {
  key: string
  name: string
  icon: string
  badge?: string
  path: string
}

export const ATOMAN_SPACES: SpaceDefinition[] = [
  { key: 'feed', name: 'Feed', icon: 'feed', badge: 'RSS', path: '/feed' },
  { key: 'music', name: '音乐', icon: 'music', badge: 'Hi-Res', path: '/music' },
  { key: 'books', name: '阅读', icon: 'books', badge: 'EPUB', path: '/books' },
  { key: 'blog', name: '博客', icon: 'blog', path: '/posts' },
  { key: 'debate', name: '辩论', icon: 'debate', path: '/debate' },
  { key: 'messages', name: '消息', icon: 'messages', path: '/inbox' },
  { key: 'studio', name: 'Studio', icon: 'studio', path: '/studio' },
]

export const SPACE_LABELS: Record<string, string> = {
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
