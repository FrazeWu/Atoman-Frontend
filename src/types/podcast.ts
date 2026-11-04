import type { Post, Collection, Channel } from "./blog";

export interface PodcastEpisode {
	rating_score?: number;
	rating_count?: number;
	viewer_rating?: number | null;
	id: string;
	post_id: string;
	post?: Post;
	collection_id?: string | null;
	collection?: Collection;
	collections?: Collection[];
	channel_id: string;
	channel?: Channel;
	audio_url: string;
	duration_sec: number;
	episode_cover_url: string;
	season_number: number;
	episode_number: number;
	created_at: string;
	updated_at: string;
}

export interface PodcastEpisodeProgress {
	id: string;
	user_id: string;
	episode_id: string;
	episode?: PodcastEpisode;
	position_sec: number;
	duration_sec: number;
	completed: boolean;
	last_played_at?: string;
}

export interface PodcastListenLater {
	id: string;
	user_id: string;
	episode_id: string;
	episode?: PodcastEpisode;
	position: number;
	created_at: string;
}

