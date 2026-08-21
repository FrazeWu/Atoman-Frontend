import type { BaseSheetLayer } from "@/composables/useSheetStack";
import type { MusicCreationFlowStep } from "./musicCreationTypes";

export type NestedActionType =
	| "revise"
	| "history"
	| "artist_history"
	| "song_history"
	| "add_album"
	| "add_artist"
	| "discussion"
	| "revise_artist"
	| "merge_artist"
	| "merge_album"
	| "link_album"
	| null;
export type MusicEditorEntity = "song";
export type MusicEditorMode = "edit";

export interface MusicEditorState {
	entity: MusicEditorEntity;
	mode: MusicEditorMode;
	id: string;
}

export interface MusicCreationFlowSeed {
	mode?: "create" | "edit";
	entity?: "artist" | "album" | "song";
	artistId?: string | null;
	albumId?: string | null;
	songId?: string | null;
	artistName?: string;
	artistLegalName?: string;
	artistSource?: string;
	startStep?: MusicCreationFlowStep;
}

export type MusicSheetLayer =
	| (BaseSheetLayer & { kind: "artist"; payload: { artistId: string } })
	| (BaseSheetLayer & { kind: "album"; payload: { albumId: string } })
	| (BaseSheetLayer & { kind: "song"; payload: { songId: string } })
	| (BaseSheetLayer & { kind: "playlist"; payload: { playlistId: string } })
	| (BaseSheetLayer & {
			kind: "action";
			payload: { action: Exclude<NestedActionType, null>; data: unknown };
	  })
	| (BaseSheetLayer & { kind: "editor"; payload: MusicEditorState })
	| (BaseSheetLayer & { kind: "creation"; payload: MusicCreationFlowSeed });
