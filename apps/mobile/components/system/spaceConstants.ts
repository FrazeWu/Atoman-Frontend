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

export interface NavTabItem {
  key: string
  label: string
  icon: string
  path: string
}

export const SPACE_TABS: Record<string, NavTabItem[]> = {
  music: [
    { key: 'discover', label: '发现', icon: 'compass', path: '/music' },
    { key: 'search', label: '搜索', icon: 'search', path: '/music/search' },
    { key: 'playlists', label: '歌单', icon: 'playlists', path: '/music/playlists' },
    { key: 'me', label: '我的', icon: 'person', path: '/music/me' },
  ],
  feed: [
    { key: 'featured', label: '精选', icon: 'compass', path: '/feed' },
    { key: 'following', label: '关注', icon: 'antenna', path: '/feed/following' },
    { key: 'starred', label: '收藏', icon: 'bookmark', path: '/feed/starred' },
    { key: 'me', label: '我的', icon: 'person', path: '/feed/me' },
  ],
  books: [
    { key: 'discover', label: '发现', icon: 'compass', path: '/books' },
    { key: 'shelf', label: '书架', icon: 'shelf', path: '/books/shelf' },
    { key: 'notes', label: '书摘', icon: 'notes', path: '/books/notes' },
    { key: 'me', label: '我的', icon: 'person', path: '/books/me' },
  ],
  blog: [
    { key: 'discover', label: '发现', icon: 'compass', path: '/posts' },
    { key: 'notes', label: '短笺', icon: 'notes', path: '/posts/notes' },
    { key: 'articles', label: '长文', icon: 'file-text', path: '/posts/articles' },
    { key: 'me', label: '我的', icon: 'person', path: '/posts/me' },
  ],
  debate: [
    { key: 'discover', label: '辩题', icon: 'compass', path: '/debate' },
    { key: 'opinions', label: '观点', icon: 'notes', path: '/debate?tab=opinions' },
    { key: 'subscriptions', label: '关注', icon: 'antenna', path: '/debate?tab=subscriptions' },
    { key: 'me', label: '我的', icon: 'person', path: '/debate?tab=mine' },
  ],
  messages: [
    { key: 'inbox', label: '私信', icon: 'messages', path: '/inbox' },
    { key: 'notifications', label: '通知', icon: 'bell', path: '/inbox/notifications' },
    { key: 'contacts', label: '联系人', icon: 'person', path: '/inbox/contacts' },
    { key: 'me', label: '设置', icon: 'settings', path: '/inbox/me' },
  ],
  studio: [
    { key: 'content', label: '内容', icon: 'library', path: '/studio' },
    { key: 'drafts', label: '草稿', icon: 'notes', path: '/studio?tab=drafts' },
    { key: 'subscriptions', label: '数据', icon: 'antenna', path: '/studio?tab=analytics' },
    { key: 'me', label: '设置', icon: 'person', path: '/me' },
  ],
}
