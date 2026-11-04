import type { User } from "./user";

export interface UserProfile {
	id: number;
	uuid: string;
	username: string;
	display_name?: string;
	avatar_url?: string;
	bio?: string;
	website?: string;
	location?: string;
	role: string;
	followers_count?: number;
	following_count?: number;
	posts_count?: number;
	quality?: number;
	contribution_total?: number;
	private_profile?: boolean;
	show_relations?: boolean;
	created_at: string;
}

export type NotificationCategory =
	| "like"
	| "interaction"
	| "mention"
	| "reply"
	| "collaboration"
	| "system";
export type InboxTab = NotificationCategory | "dm";
export type NotificationFilterType = NotificationCategory;

export interface Notification {
	id: string;
	recipient_id: string;
	actor_id?: string | null;
	actor?: User | null;
	latest_actor?: User | null;
	type: string;
	category: NotificationCategory;
	reason: string;
	source_type: string;
	source_id: string;
	source_url?: string;
	aggregate_key?: string;
	aggregation_key?: string | null;
	actor_count: number;
	meta: {
		title?: string;
		body?: string;
		source_label?: string;
		topic_id?: string;
		topic_title?: string;
		reply_excerpt?: string;
		actor_count?: number;
		recent_actors?: string[];
		target_kind?:
			| "blog_post"
			| "video"
			| "podcast_episode"
			| "feed_article"
			| "music_artist"
			| "music_album"
			| "music_song"
			| "forum_topic"
			| "debate"
			| "timeline_event"
			| "timeline_person";
		resource_id?: string;
		comment_id?: string;
		root_id?: string;
		module?: string;
		path?: string;
		like_count?: number;
		[key: string]: unknown;
	};
	read_at?: string | null;
	created_at: string;
	updated_at: string;
}

export interface NotificationUnreadCounts {
	total: number;
	items: Record<InboxTab, number>;
}

export interface NotificationPreference {
	id?: string;
	category: NotificationCategory;
	event_type: string;
	enabled: boolean;
}

export interface NotificationMute {
	id: string;
	source_type: string;
	source_id: string;
	reason: string;
	created_at: string;
}

export interface BlockedUser {
	id: string;
	blocked_id: string;
	blocked?: User;
	created_at: string;
}

export interface UserSettings {
	user_id: string;
	private_profile: boolean;
	show_relations?: boolean;
	dm_permission?: "anyone" | "following_only" | "one_before_reply";
}

// Existing settings screens still use this form value until the settings migration.
export type DMPermission = "anyone" | "following_only" | "one_before_reply";

// ===== Debate Types =====
