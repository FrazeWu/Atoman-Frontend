export type MediaPickerType = 'song' | 'album' | 'video'

export interface MediaPickerItem {
  id: string
  type: MediaPickerType
  title: string
  subtitle?: string
  cover_url?: string
}
