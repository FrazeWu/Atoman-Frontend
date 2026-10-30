import type { User } from '@/types'

export type MusicEntryStatus = 'open' | 'confirmed' | 'disputed'

export interface ArtistAlias {
  id: string
  artist_id: string
  alias: string
  is_main_name: boolean
  created_at: string
}

export interface LyricAnnotation {
  id: string
  song_id: string
  line_number: number
  content: string
  user?: User
  created_at: string
}

export interface Artist {
  id: number | string
  name: string
  bio?: string
  image_url?: string
  nationality?: string
  birth_year?: number
  death_year?: number
  members?: string
  entry_status?: MusicEntryStatus
  aliases?: ArtistAlias[]
  created_at?: string
  updated_at?: string
}

export interface Song {
  summary_only?: boolean
  id: number | string
  source_type?: 'music' | 'podcast_episode' | 'feed_podcast'
  source_id?: string
  playlist_id?: string
  title: string
  artist?: string
  album?: string
  album_id?: number | string
  release_type?: string
  year?: number
  release_date?: string
  lyrics?: string
  audio_url: string
  audio_status?: string
  waveform_peaks?: number[]
  waveform_data?: number[]
  duration?: number
  media_kind?: 'music_song' | 'feed_item'
  audio_source?: 'local' | 's3'
  cover_url?: string
  cover_source?: 'local' | 's3'
  track_number?: number
  disc_number?: number
  status?: 'open' | 'closed' | 'pending' | 'approved' | 'rejected'
  uploaded_by?: number
  artists?: Artist[]
  entry_status?: MusicEntryStatus
  recommendation_context?: MusicRecommendationContext
  created_at?: string
  updated_at?: string
}

export interface Album {
  id: number
  title: string
  year?: number
  release_date?: string
  cover_url?: string
  cover_source?: 'local' | 's3'
  status: 'open' | 'closed' | 'pending' | 'approved' | 'rejected'
  album_type?: string
  entry_status?: MusicEntryStatus
  uploaded_by?: number
  artists?: Artist[]
  songs?: Song[]
  created_at?: string
  updated_at?: string
}

export type MusicRecommendationContext = {
  request_id: string
  surface: 'music_home'
  position: number
  reason?: string
}
