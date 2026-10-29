export interface NavTabItem {
  key: string
  label: string
  icon: string
  path: string
}

export const SPACE_TABS: Record<string, NavTabItem[]> = {
  global: [
    { key: 'home', label: '首页', icon: 'compass', path: '/' },
    { key: 'modules', label: '模块', icon: 'library', path: '/modules' },
    { key: 'search', label: '搜索', icon: 'search', path: '/search' },
    { key: 'me', label: '我的', icon: 'person', path: '/me' },
  ],
  podcast: [
    { key: 'discover', label: '发现', icon: 'mic', path: '/podcasts' },
    { key: 'subscriptions', label: '订阅', icon: 'antenna', path: '/podcasts/subscriptions' },
    { key: 'favorites', label: '收藏', icon: 'bookmark', path: '/podcasts/favorites' },
    { key: 'me', label: '我的', icon: 'person', path: '/podcasts/me' },
  ],
  video: [
    { key: 'discover', label: '发现', icon: 'play', path: '/videos' },
    { key: 'search', label: '搜索', icon: 'search', path: '/videos/search' },
    { key: 'subscriptions', label: '订阅', icon: 'antenna', path: '/videos/subscriptions' },
    { key: 'favorites', label: '收藏', icon: 'bookmark', path: '/videos/favorites' },
  ],
  forum: [
    { key: 'topics', label: '话题', icon: 'messages', path: '/forum' },
    { key: 'categories', label: '分类', icon: 'library', path: '/forum/categories' },
    { key: 'search', label: '搜索', icon: 'search', path: '/forum/search' },
    { key: 'me', label: '我的', icon: 'person', path: '/forum/me' },
  ],
  timeline: [
    { key: 'home', label: '时间线', icon: 'clock', path: '/timeline' },
    { key: 'persons', label: '人物', icon: 'person', path: '/timeline/persons' },
    { key: 'search', label: '搜索', icon: 'search', path: '/timeline/search' },
    { key: 'me', label: '我的', icon: 'person', path: '/timeline/me' },
  ],
  music: [
    { key: 'discover', label: '发现', icon: 'compass', path: '/music' },
    { key: 'search', label: '搜索', icon: 'search', path: '/music/search' },
    { key: 'playlists', label: '歌单', icon: 'playlists', path: '/music/playlists' },
    { key: 'me', label: '我的', icon: 'person', path: '/music/me' },
  ],
  feed: [
    { key: 'featured', label: '浏览', icon: 'compass', path: '/feed' },
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
