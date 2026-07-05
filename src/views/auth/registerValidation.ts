const usernamePattern = /^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/

const reservedUsernames = new Set([
  'feed', 'media', 'music', 'blog', 'forum', 'debate', 'timeline', 'podcast', 'video',
  'www', 'api', 'admin', 'root', 'portal', 'auth', 'login', 'logout', 'register', 'signup', 'signin',
  'account', 'accounts', 'setting', 'settings', 'profile', 'profiles', 'user', 'users', 'member', 'members',
  'channel', 'channels', 'post', 'posts', 'article', 'articles', 'collection', 'collections',
  'topic', 'topics', 'comment', 'comments', 'bookmark', 'bookmarks', 'notification', 'notifications',
  'inbox', 'dm', 'message', 'messages', 'search', 'explore', 'discover', 'upload', 'uploads',
  'song', 'songs', 'album', 'albums', 'artist', 'artists', 'playlist', 'playlists', 'watch',
  'episode', 'episodes', 'subscription', 'subscriptions', 'rss', 'atom', 'feed-source',
  'help', 'about', 'terms', 'privacy', 'contact', 'support', 'static', 'assets', 'cdn', 'status',
  'health', 'metrics', 'dev', 'test', 'stage', 'staging', 'prod', 'production',
])

export function validateRegisterUsername(username: string) {
  const trimmed = username.trim()
  if (trimmed.length < 2 || trimmed.length > 30) {
    return '用户名长度需要在 2 到 30 个字符之间'
  }
  if (!usernamePattern.test(trimmed)) {
    return '用户名只能使用小写字母、数字或连字符'
  }
  const normalized = trimmed.toLowerCase()
  if (reservedUsernames.has(normalized)) {
    return '该用户名暂时不可用'
  }
  return null
}
