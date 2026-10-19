export type MediaPickerType = 'song' | 'album' | 'video'

export interface MediaPickerItem {
  id: string
  type: MediaPickerType
  title: string
  subtitle?: string
  cover_url?: string
  artist?: string
  album_id?: string
  album_title?: string
  year?: number
  song_count?: number
}
