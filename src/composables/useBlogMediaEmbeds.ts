import { ref } from 'vue'
import { apiRequestResult } from '@/api/client'
import { getMusicAlbum, getMusicSongDetail } from '@/api/musicV1'
import { getVideo } from '@/api/video'
import type { MusicAlbumListItem, MusicSongDetail, MusicSongListItem } from '@/api/musicV1/types'
import type { Post, Song, Video } from '@/types'
import { useApi } from '@/composables/useApi'
import { resolveMediaURL, resolvePlayableAudioURL } from '@/utils/mediaUrl'
import type { EmbedData } from '@/composables/useMarkdownRenderer'

type EmbedKind = 'post' | 'music' | 'video'

const embedPatterns: Record<EmbedKind, RegExp> = {
  post: /:::post\{id="([0-9a-fA-F-]{36})"\}\s*:::/g,
  music: /:::music\{id="([0-9a-fA-F-]{36})"\}\s*:::/g,
  video: /:::video\{id="([0-9a-fA-F-]{36})"\}\s*:::/g,
}

export function extractBlogEmbedIds(content: string, kind: EmbedKind): string[] {
  return [...new Set(Array.from(content.matchAll(embedPatterns[kind]), (match) => match[1]))]
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function unwrap<T>(payload: T | { data?: T }): T {
  if (payload && typeof payload === 'object' && 'data' in payload && payload.data !== undefined) {
    return payload.data as T
  }
  return payload as T
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds < 0) return ''
  const total = Math.round(seconds)
  const minutes = Math.floor(total / 60)
  const remainder = String(total % 60).padStart(2, '0')
  return `${minutes}:${remainder}`
}

function formatArtists(artists?: Array<{ name: string }>): string {
  return artists?.map((artist) => artist.name).filter(Boolean).join(' / ') || ''
}

function toPlaybackSong(
  source: {
    id: string
    title: string
    audio_url?: string
    cover_url?: string
    lyrics?: string
    track_number?: number
    disc_number?: number
    artists?: Array<{ id: string; name: string }>
  },
  album?: {
    id: string
    title: string
    year?: number
    release_date?: string
    cover_url?: string
    artists?: Array<{ id: string; name: string }>
  },
): Song {
  const artists = source.artists?.length ? source.artists : album?.artists
  return {
    id: source.id,
    title: source.title,
    artist: formatArtists(artists) || '未知艺术家',
    album: album?.title || '',
    album_id: album?.id || '',
    year: album?.year || 0,
    release_date: album?.release_date || '',
    lyrics: source.lyrics || '',
    audio_url: source.audio_url ? resolvePlayableAudioURL(source.audio_url) : '',
    cover_url: source.cover_url || album?.cover_url || '',
    track_number: source.track_number,
    disc_number: source.disc_number,
    artists,
    status: 'open',
  }
}

function mapPostEmbed(id: string, post: Post): EmbedData {
  return {
    id,
    kind: 'post',
    title: post.title,
    summary: post.summary,
    meta: post.channel?.name,
    href: `/posts/post/${id}`,
  }
}

function mapAlbumEmbed(id: string, album: MusicAlbumListItem): EmbedData {
  const artists = formatArtists(album.artists)
  const details = [artists, album.year ? String(album.year) : album.release_date, album.songs?.length ? `${album.songs.length} 首` : '']
    .filter(Boolean)
    .join(' · ')
  const albumInfo = {
    id: album.id,
    title: album.title,
    year: album.year,
    release_date: album.release_date,
    cover_url: album.cover_url,
    artists: album.artists,
  }
  const playbackSongs = (album.songs || [])
    .map((song) => toPlaybackSong(song, albumInfo))
    .filter((song) => Boolean(song.audio_url))
  return {
    id,
    kind: 'album',
    title: album.title,
    summary: album.description,
    meta: details || '专辑',
    imageUrl: album.cover_url ? resolveMediaURL(album.cover_url) : undefined,
    href: `/music/album/${id}`,
    playbackSongs,
  }
}

function mapSongEmbed(id: string, song: MusicSongListItem): EmbedData {
  const artists = formatArtists(song.artists)
  const details = [artists, song.album?.title, formatDuration(song.duration_sec)]
    .filter(Boolean)
    .join(' · ')
  return {
    id,
    kind: 'song',
    title: song.title,
    summary: song.description,
    meta: details || '单曲',
    imageUrl: song.cover_url || song.album?.cover_url
      ? resolveMediaURL(song.cover_url || song.album?.cover_url || '')
      : undefined,
    audioSrc: song.audio_url ? resolvePlayableAudioURL(song.audio_url) : undefined,
    href: `/music/song/${id}`,
    playbackSongs: song.audio_url ? [toPlaybackSong(song, song.album)] : [],
  }
}

function trustedVideoFrameUrl(source: string): string | undefined {
  const youtube = source.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}?rel=0&autoplay=0`

  const bilibili = source.match(/bilibili\.com\/video\/(BV[A-Za-z0-9]+)/)
  if (bilibili) return `https://player.bilibili.com/player.html?bvid=${bilibili[1]}&autoplay=0`

  return undefined
}

function mapVideoEmbed(id: string, video: Video): EmbedData {
  const source = video.video_url ? resolveMediaURL(video.video_url) : ''
  const poster = video.thumbnail_url ? resolveMediaURL(video.thumbnail_url) : undefined
  const iframeSrc = trustedVideoFrameUrl(video.video_url || '')
  return {
    id,
    kind: 'video',
    title: video.title,
    summary: video.description,
    meta: formatDuration(video.duration_sec),
    href: `/videos/watch/${id}`,
    videoSrc: source && !iframeSrc ? source : undefined,
    iframeSrc,
    posterUrl: poster,
    duration: video.duration_sec,
    video,
  }
}

export function useBlogMediaEmbeds() {
  const api = useApi()
  const postEmbeds = ref<Record<string, EmbedData>>({})
  const musicEmbeds = ref<Record<string, EmbedData>>({})
  const videoEmbeds = ref<Record<string, EmbedData>>({})
  let requestSequence = 0

  async function loadPosts(content: string, token?: string) {
    const entries = await Promise.all(extractBlogEmbedIds(content, 'post').map(async (id) => {
      try {
        const result = await apiRequestResult(api.blog.post(id), { headers: authHeaders(token) })
        if (!result.ok) return null
        return [id, mapPostEmbed(id, unwrap(result.data))] as const
      } catch {
        return null
      }
    }))
    return Object.fromEntries(entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null))
  }

  async function loadMusic(content: string) {
    const entries = await Promise.all(extractBlogEmbedIds(content, 'music').map(async (id) => {
      try {
        return [id, mapAlbumEmbed(id, await getMusicAlbum(id))] as const
      } catch {
        try {
          const detail: MusicSongDetail = await getMusicSongDetail(id)
          return [id, mapSongEmbed(id, detail.song)] as const
        } catch {
          return null
        }
      }
    }))
    return Object.fromEntries(entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null))
  }

  async function loadVideos(content: string, token?: string) {
    const entries = await Promise.all(extractBlogEmbedIds(content, 'video').map(async (id) => {
      try {
        return [id, mapVideoEmbed(id, await getVideo(id, token))] as const
      } catch {
        return null
      }
    }))
    return Object.fromEntries(entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null))
  }

  async function load(content: string, token?: string) {
    const sequence = ++requestSequence
    postEmbeds.value = {}
    musicEmbeds.value = {}
    videoEmbeds.value = {}

    const [posts, music, videos] = await Promise.all([
      loadPosts(content, token),
      loadMusic(content),
      loadVideos(content, token),
    ])

    if (sequence !== requestSequence) return
    postEmbeds.value = posts
    musicEmbeds.value = music
    videoEmbeds.value = videos
  }

  return { postEmbeds, musicEmbeds, videoEmbeds, load }
}
