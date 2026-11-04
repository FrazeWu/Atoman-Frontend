import type { User } from "./user";
import type { Channel, Collection } from "./blog";

export interface VideoTag {
	id: string;
	name: string;
	created_at: string;
	updated_at: string;
}

export type VideoProcessingStatus =
	| "none"
	| "pending"
	| "processing"
	| "ready"
	| "failed";

export interface VideoPreviewThumbnail {
	time_sec: number;
	url: string;
	width: number;
	height: number;
}

export interface VideoChapter { title: string; start_sec: number }

export interface Video {
	id: string;
	channel_id: string | null;
	channel?: Channel;
	collection_id?: string | null;
	collection?: Collection;
	collection_position?: number;
	collection_conflict?: boolean;
	user_id: string;
	user?: User;
	title: string;
	description: string;
	storage_type: "local" | "external";
	video_url: string;
	thumbnail_url: string;
	duration_sec: number;
	visibility: "public" | "followers" | "private";
	status: "draft" | "published";
	view_count: number;
	like_count?: number;
	liked?: boolean;
	rating_score?: number;
	rating_count?: number;
	viewer_rating?: number | null;
	subtitle_url?: string;
	chapters?: VideoChapter[];
	processing_status?: VideoProcessingStatus;
	processing_error?: string;
	preview_thumbnails?: VideoPreviewThumbnail[];
	tags: VideoTag[];
	collections?: Collection[];
	created_at: string;
	updated_at: string;
}

