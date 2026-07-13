import type { BaseSheetLayer } from '@/composables/useSheetStack'
import type { MusicCreationFlowStep } from './musicCreationTypes'

export type NestedActionType = 'revise' | 'history' | 'artist_history' | 'add_album' | 'add_artist' | 'discussion' | 'revise_artist' | 'merge_artist' | 'merge_album' | null
export type MusicEditorEntity = 'artist' | 'album'
export type MusicEditorMode = 'create' | 'edit'

export interface MusicEditorState {
  entity: MusicEditorEntity
  mode: MusicEditorMode
  id?: string
  seed?: Record<string, unknown>
}

export interface MusicCreationFlowSeed {
  artistId?: string | null
  artistName?: string
  artistLegalName?: string
  startStep?: MusicCreationFlowStep
}

export type MusicSheetLayer =
  | (BaseSheetLayer & { kind: 'artist'; payload: { artistId: string } })
  | (BaseSheetLayer & { kind: 'album'; payload: { albumId: string } })
  | (BaseSheetLayer & { kind: 'playlist'; payload: { playlistId: string } })
  | (BaseSheetLayer & { kind: 'action'; payload: { action: Exclude<NestedActionType, null>; data: unknown } })
  | (BaseSheetLayer & { kind: 'editor'; payload: MusicEditorState })
  | (BaseSheetLayer & { kind: 'creation'; payload: MusicCreationFlowSeed })
