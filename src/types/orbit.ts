import type { FeedSource } from "./feed";

export interface OrbitItem {
	id: string;
	feed_source_id: string;
	feed_source?: FeedSource;
	guid: string;
	title: string;
	link: string;
	summary: string;
	author: string;
	published_at: string;
	fetched_at: string;
	enclosure_url?: string;
	enclosure_type?: string;
	duration?: string;
	image_url?: string;
	is_starred?: boolean;
}

// ===== Forum Types =====
