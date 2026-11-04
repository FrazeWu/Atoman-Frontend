import type { Post } from "./blog";

export interface BookmarkFolder {
	id: string;
	user_id: string;
	name: string;
	created_at: string;
	updated_at: string;
}

export interface Bookmark {
	id: string;
	user_id: string;
	content_id: string;
	content?: Post;
	bookmark_folder_id?: string;
	bookmark_folder?: BookmarkFolder;
	created_at: string;
	updated_at: string;
}

// ===== Orbit Types =====
