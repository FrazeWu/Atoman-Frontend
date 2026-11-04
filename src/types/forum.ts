import type { ResolvedReference } from "@/api/references";
import type { User, ForumGroup } from "./user";

export interface ForumTopicState {
	closed: boolean;
	solved: boolean;
	pinned: boolean;
	featured: boolean;
}

export interface ForumTopicPermissions {
	edit: boolean;
	delete: boolean;
	reply: boolean;
	mark_answer: boolean;
	pin: boolean;
	lock: boolean;
	feature: boolean;
	report: boolean;
}

export interface ForumCategory {
	id: string;
	name: string;
	description?: string;
	color: string;
	topic_count?: number;
	created_at: string;
}

export interface ForumTopic {
	id: string;
	user_id: string;
	user?: User;
	category_id: string;
	category?: ForumCategory;
	title: string;
	content: string; // raw Markdown
	tags: string[];
	pinned: boolean;
	featured: boolean;
	closed: boolean;
	is_solved?: boolean;
	solved_reply_id?: string;
	reply_count: number;
	like_count: number;
	view_count: number;
	last_reply_at?: string;
	is_liked: boolean;
	is_bookmarked: boolean;
	can_edit_topic?: boolean;
	can_pin_topic?: boolean;
	can_lock_topic?: boolean;
	state?: ForumTopicState;
	permissions?: ForumTopicPermissions;
	references?: ResolvedReference[];
	created_at: string;
	updated_at: string;
}

export interface ForumReply {
	id: string;
	topic_id: string;
	user_id: string;
	user?: User;
	parent_reply_id?: string; // quoted reply id
	content: string; // raw Markdown
	path: string;
	floor_number: number;
	depth?: number;
	is_solved?: boolean;
	like_count: number;
	is_liked: boolean;
	created_at: string;
	updated_at: string;
}

export interface ForumDraft {
	id?: string;
	context_key: string;
	title?: string;
	content: string;
	tags?: string;
	updated_at?: string;
}

export type ForumFollowTargetType = "topic" | "category" | "tag";

export interface ForumFollow {
	id: string;
	user_id: string;
	target_type: ForumFollowTargetType;
	target_key: string;
	created_at: string;
	updated_at: string;
}

// ===== Profile Types =====
