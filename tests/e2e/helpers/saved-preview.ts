import type { Page } from '@playwright/test'
import { mockDiscoveryPreview, previewAlbums, previewArticles, previewVideos } from './discovery-preview'

export async function mockSavedPreview(page: Page, options: { failRemoval?: boolean; empty?: boolean; failLoad?: boolean } = {}) {
  await mockDiscoveryPreview(page)
  const articles = Array.from({ length: 8 }, (_, index) => ({
    ...previewArticles[index % previewArticles.length]!,
    id: `saved-${index + 1}`,
    source_title: '生活提案',
    published_at: '2026-10-07T09:00:00Z',
    content: '<p>从一段散步开始，给生活留一点空白。</p>'.repeat(20),
    feed_source_id: 'source-1',
    feed_source: { id: 'source-1', title: '生活提案', rss_url: 'https://example.test/rss' },
  }))
  let reading = options.empty ? [] : articles.slice(0, 3).map((feed_item) => ({ target_type: 'feed_item', target_id: feed_item.id, feed_item, created_at: feed_item.published_at }))
  let albumBookmarks = options.empty ? [] : previewAlbums.map((album) => ({ id: `bookmark-${album.id}`, album_id: album.id, album }))
  let songs = options.empty ? [] : previewAlbums.map((album, index) => ({
    id: `song-${index + 1}`, title: ['夏天的风', '夜色温柔', '远行', '山间来信'][index],
    cover_url: album.cover_url, artists: album.artists, album, audio_url: '', duration_seconds: 215,
  }))
  let history = songs.map((song, index) => ({ id: `history-${index}`, song, play_count: 3, last_played_at: '2026-10-07T19:30:00Z' }))
  let videos = options.empty ? [] : previewVideos.map((video) => ({ id: `saved-${video.id}`, video_id: video.id, video }))
  const list = (data: unknown[]) => ({ data, meta: { page: 1, page_size: 24, total: data.length, has_more: false } })
  let failedLoad = false
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname
    let body: unknown
    if (request.method() === 'DELETE') {
      if (options.failRemoval && pathname.includes('/music/')) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: '暂时无法移除' }) })
        return
      }
      const id = pathname.split('/').at(-1)
      reading = reading.filter((entry) => entry.target_id !== id)
      albumBookmarks = albumBookmarks.filter((entry) => entry.album_id !== id)
      songs = songs.filter((song) => song.id !== id)
      videos = videos.filter((entry) => entry.id !== id)
      if (pathname.endsWith('/music/history')) history = []
      body = { data: { deleted: true } }
    } else if (pathname.endsWith('/feed/star-groups')) {
      body = { data: [{ id: 'group-1', name: '全部收藏' }, { id: 'group-2', name: '阅读灵感' }] }
    } else if (pathname.endsWith('/feed/stars')) {
      body = { items: options.empty ? [] : articles, total: options.empty ? 0 : articles.length }
    } else if (pathname.endsWith('/feed/reading-list')) {
      if (options.failLoad && !failedLoad) {
        failedLoad = true
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: '暂时无法加载' }) })
        return
      }
      body = list(reading)
    } else if (pathname.includes('/feed/items/saved-')) {
      const item = articles.find((article) => pathname.includes(article.id)) || articles[0]
      body = { data: { item, reader: { default_variant: 'rss', rss: { html: item!.content }, full_text: { status: 'success', html: item!.content } } } }
    } else if (pathname.endsWith('/music/library')) {
      body = list(url.searchParams.get('kind') === 'later' ? songs.map((song) => ({ song })) : albumBookmarks)
    } else if (pathname.endsWith('/music/history')) {
      body = list(history)
    } else if (pathname.endsWith('/music/playlists')) {
      body = list([{ id: 'favorite-1', name: '最爱', kind: 'favorite', song_count: 0 }])
    } else if (pathname.endsWith('/music/playlists/favorite-1/songs/status')) {
      body = { data: { song_ids: [] } }
    } else if (pathname.endsWith('/blog/bookmark-folders')) {
      body = { data: [{ id: 'folder-1', name: '阅读' }, { id: 'folder-2', name: '设计灵感' }] }
    } else if (pathname.endsWith('/blog/bookmarks')) {
      body = { data: options.empty ? [] : previewArticles.map((article, index) => ({ id: `bookmark-post-${index}`, bookmark_folder_id: 'folder-1', content: { ...article, id: `post-${index}`, created_at: '2026-10-07T09:00:00Z', user: { username: '作者', display_name: '生活提案' } } })) }
    } else if (pathname.endsWith('/videos/bookmarks')) {
      body = { data: videos }
    } else if (pathname.endsWith('/videos/channel-bookmarks')) {
      body = { data: [{ channel: { id: 'channel-1', name: '日常观察' } }] }
    } else {
      await route.fallback()
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}
