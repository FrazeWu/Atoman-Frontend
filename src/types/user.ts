export type RepeatMode = "none" | "one" | "all";

export interface User {
	id?: number;
	uuid?: string;
	username: string;
	email: string;
	has_password?: boolean;
	role?: "user" | "moderator" | "admin" | "owner";
	display_name?: string;
	avatar_url?: string;
	bio?: string;
	website?: string;
	location?: string;
	onboarding_completed_at?: string | null;
	is_active?: boolean;
	created_at?: string;
	updated_at?: string;
	forum_trust_level?: number;
	quality?: number;
	contribution_total?: number;
}

export interface ForumGroupMember {
	id: string;
	group_id: string;
	user_id: string;
	user?: User;
}

export interface ForumGroup {
	id: string;
	name: string;
	description?: string;
	members?: ForumGroupMember[];
}

export interface ForumCategoryPermission {
	id: string;
	category_id: string;
	group_id: string;
	can_view: boolean;
	can_create_topic: boolean;
	can_comment: boolean;
}

// ===== Blog Types =====
