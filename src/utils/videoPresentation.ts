import type { Video } from '@/types'

type VideoMedia = Pick<Video, 'thumbnail_url' | 'preview_thumbnails' | 'channel' | 'user'>

export function videoThumbnailSource(video: VideoMedia): string {
  const cover = video.thumbnail_url?.trim()
  if (cover) return cover
  return video.preview_thumbnails?.find((thumbnail) => thumbnail.url?.trim())?.url?.trim() || ''
}

export function videoAvatarSource(video: VideoMedia): string {
  return video.channel?.cover_url?.trim() || video.user?.avatar_url?.trim() || ''
}
