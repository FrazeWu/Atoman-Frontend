import { computed, ref } from 'vue'
import { apiGetRaw } from '@/api/client'
import { useApi } from '@/composables/useApi'
import type { PodcastEpisode, Post, Video } from '@/types'

export type MediaMixedItem = {
  id: string
  type: 'article' | 'podcast'
  title: string
  updated_at: string
}

export type MediaVideoItem = {
  id: string
  title: string
  cover_url?: string
  updated_at: string
}

export function useMediaOverview() {
  const mixedItems = ref<MediaMixedItem[]>([])
  const videoItems = ref<MediaVideoItem[]>([])
  const expandedMixed = ref(false)
  const loadingOverview = ref(false)

  const visibleMixedItems = computed(() => (
    expandedMixed.value ? mixedItems.value : mixedItems.value.slice(0, 5)
  ))

  const loadOverview = async (channelId: string | null) => {
    loadingOverview.value = true
    try {
      const api = useApi()
      const channelQuery = channelId ? `channel_id=${encodeURIComponent(channelId)}` : ''
      const articleUrl = `${api.blog.posts}?${[channelQuery, 'page_size=5'].filter(Boolean).join('&')}`
      const podcastUrl = `${api.podcast.episodes}?${[channelQuery, 'limit=5'].filter(Boolean).join('&')}`
      const videoUrl = `${api.videos.list}?${[channelQuery, 'limit=6'].filter(Boolean).join('&')}`

      const [articleData, podcastData, videoData] = await Promise.all([
        apiGetRaw<Post[] | { data?: Post[] }>(articleUrl),
        apiGetRaw<PodcastEpisode[] | { data?: PodcastEpisode[]; episodes?: PodcastEpisode[] }>(podcastUrl),
        apiGetRaw<Video[] | { data?: Video[] }>(videoUrl),
      ])

      const articles: Post[] = Array.isArray(articleData) ? articleData : (articleData.data || [])
      const podcasts: PodcastEpisode[] = Array.isArray(podcastData) ? podcastData : (podcastData.data || podcastData.episodes || [])
      const videos: Video[] = Array.isArray(videoData) ? videoData : (videoData.data || [])

      mixedItems.value = [
        ...articles.map(post => ({
          id: post.id,
          type: 'article' as const,
          title: post.title,
          updated_at: post.updated_at,
        })),
        ...podcasts.map(episode => ({
          id: episode.id,
          type: 'podcast' as const,
          title: episode.post?.title || '未命名单集',
          updated_at: episode.updated_at,
        })),
      ].sort((a, b) => b.updated_at.localeCompare(a.updated_at))

      videoItems.value = videos.map(video => ({
        id: video.id,
        title: video.title,
        cover_url: video.thumbnail_url,
        updated_at: video.updated_at,
      }))
    } finally {
      loadingOverview.value = false
    }
  }

  return {
    mixedItems,
    videoItems,
    loadingOverview,
    expandedMixed,
    visibleMixedItems,
    loadOverview,
  }
}
