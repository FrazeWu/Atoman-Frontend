import type { Page } from '@playwright/test'

function cover(background: string, foreground: string, label: string, wide = false) {
  const width = wide ? 640 : 320
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 320"><rect width="${width}" height="320" fill="${background}"/><circle cx="${width * 0.72}" cy="98" r="54" fill="${foreground}"/><path d="M0 230 Q100 130 210 220 T${width} 175 V320 H0Z" fill="${foreground}" opacity=".5"/><path d="M0 275 Q180 175 ${width} 270 V320 H0Z" fill="${foreground}" opacity=".7"/><text x="28" y="48" fill="${foreground}" font-family="sans-serif" font-size="18" letter-spacing="3">${label}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export const previewAlbums = [
  { id: 'album-1', title: '风从海上来', year: 2025, cover_url: cover('#e9e1ce', '#536459', 'SEA BREEZE'), artists: [{ id: 'artist-1', name: '陈粒' }] },
  { id: 'album-2', title: '蓝色的夜', year: 2024, cover_url: cover('#c9d6e5', '#445a7b', 'BLUE HOURS'), artists: [{ id: 'artist-2', name: '落日飞车' }] },
  { id: 'album-3', title: '在路上', year: 2026, cover_url: cover('#e8d5cb', '#955d4d', 'ON THE ROAD'), artists: [{ id: 'artist-3', name: '房东的猫' }] },
  { id: 'album-4', title: '山间来信', year: 2025, cover_url: cover('#dbe0cf', '#647650', 'LETTERS'), artists: [{ id: 'artist-4', name: '声音玩具' }] },
]

export const previewArticles = [
  { id: 'article-1', title: '慢下来，重新发现日常的美', summary: '从一杯咖啡、一段散步开始，给生活留一点空白。那些被忽略的小事，也许正是我们需要的答案。', source_title: '生活提案' },
  { id: 'article-2', title: '一个人的书房，和一座城市的记忆', summary: '走进街角的独立书店，听店主讲述书与人的故事。阅读让我们与更辽阔的世界相遇。', source_title: '城市漫游' },
  { id: 'article-3', title: '好的设计，让复杂的事情变简单', summary: '从日常物件出发，聊聊那些不动声色却改变体验的设计细节。', source_title: '设计笔记' },
].map((article) => ({ ...article, source_type: 'external', source_category: 'RSS', last_published_at: '2026-10-07T09:00:00Z', view_count: 128, bookmark_count: 16 }))

export const previewVideos = [
  { id: 'video-1', title: '沿着海岸线，找回生活的节奏', thumbnail_url: cover('#dbe5e6', '#567c7c', 'A DAY BY THE SEA', true), channel: { id: 'channel-1', name: '日常观察' } },
  { id: 'video-2', title: '山间小屋：留给自己的一个周末', thumbnail_url: cover('#e3dfcb', '#6c7555', 'WEEKEND IN THE WOODS', true), channel: { id: 'channel-2', name: '山野之间' } },
].map((video) => ({ ...video, duration_sec: 728, view_count: 18320, created_at: '2026-10-06T09:00:00Z', tags: [] }))

export async function mockDiscoveryPreview(page: Page) {
  const list = (data: unknown[] = []) => ({ data, meta: { page: 1, page_size: 100, total: data.length, has_more: false } })
  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    let body: unknown = list()
    if (pathname.endsWith('/auth/session')) {
      body = { csrf_token: 'preview-csrf', user: { uuid: 'preview-user', username: 'preview', email: 'preview@example.test' } }
    } else if (pathname.endsWith('/site/access')) {
      body = { modules: Object.fromEntries(['feed', 'music', 'video'].map((module) => [module, { enabled: true, features: {} }])) }
    } else if (pathname.endsWith('/feed/recommend/articles')) {
      body = list(previewArticles)
    } else if (pathname.endsWith('/feed/recommend/channels')) {
      body = list([{ id: 'source-1', title: '设计笔记', description: '观察生活中的设计，分享值得阅读的故事。', source_type: 'external_rss', rss_url: 'https://example.test/rss', article_count: 32 }])
    } else if (pathname.endsWith('/music/home')) {
      body = { data: { personalized: false, recently_played: [], for_you: [] } }
    } else if (pathname.endsWith('/music/albums')) {
      body = list(previewAlbums)
    } else if (pathname.endsWith('/music/albums/album-1')) {
      body = { data: { ...previewAlbums[0], songs: [] } }
    } else if (pathname.includes('/music/recommend/')) {
      body = list(previewAlbums.slice(0, 3).map((album) => ({ id: album.artists[0]!.id, name: album.artists[0]!.name, title: album.artists[0]!.name, image_url: album.cover_url })))
    } else if (pathname.endsWith('/music/playlists/public')) {
      body = list([{ id: 'playlist-1', name: '给散步的你', description: '轻柔旋律，陪你走过城市的黄昏', cover_url: previewAlbums[2]!.cover_url, song_count: 24 }])
    } else if (pathname.endsWith('/videos/recommend/items')) {
      body = list(previewVideos.map((video) => ({ id: video.id, title: video.title, video })))
    } else if (pathname.endsWith('/videos')) {
      body = list(previewVideos)
    } else if (pathname.endsWith('/videos/video-1')) {
      body = { ...previewVideos[0], description: '去看海，享受平静的一天。', video_url: '', storage_type: 'external', visibility: 'public', collections: [] }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}
