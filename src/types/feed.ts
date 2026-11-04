import type { Post, ShortNote } from "./blog";
import type { PodcastEpisode } from "./podcast";
import type { Video } from "./video";
import type { OrbitItem } from "./orbit";

export interface FeedDiscoveryCandidate {
	title: string;
	feed_url: string;
	site_url?: string;
	kind?: string;
	score: number;
	reason?: string;
	is_default: boolean;
}

export type FeedSourceProvider = "rss" | "rsshub" | "internal";

export type ResolvedSubscriptionStatus =
	| "already_subscribed"
	| "existing_source"
	| "new_source"
	| "multiple_candidates"
	| "not_found"
	| "invalid";

export interface ResolvedSubscriptionSource {
	id?: string;
	provider: FeedSourceProvider;
	platform?: "youtube" | "bilibili" | "github";
	content_type?: "video" | "project_update";
	source_type:
		| "external_rss"
		| "internal_user"
		| "internal_channel"
		| "internal_collection";
	category?: FeedSourceCategory;
	title: string;
	rss_url: string;
	site_url?: string;
	canonical_url: string;
}

export interface ResolvedSubscriptionCandidate extends FeedDiscoveryCandidate {
	status: ResolvedSubscriptionStatus;
	source?: ResolvedSubscriptionSource | null;
	subscription?: Subscription;
}

export interface ResolvedSubscriptionInput {
	status: ResolvedSubscriptionStatus;
	source?: ResolvedSubscriptionSource | null;
	subscription?: Subscription | null;
	candidates: ResolvedSubscriptionCandidate[];
	message: string;
}

export type FeedSourceCategory =
	| "blog"
	| "news"
	| "social"
	| "video"
	| "forum"
	| "podcast";

export interface AutoAddSubscriptionPayload {
	input: string;
	candidate_feed_url?: string;
	title?: string;
	group_id?: string;
	category?: FeedSourceCategory;
}

export interface AdminFeedSourceRow {
	id: string;
	source_type:
		| "external_rss"
		| "internal_user"
		| "internal_channel"
		| "internal_collection";
	provider: FeedSourceProvider;
	title: string;
	rss_url?: string;
	canonical_url?: string;
	site_url?: string;
	hidden: boolean;
	health_status: "healthy" | "warning" | "error" | "failed" | "stale";
	last_error?: string;
	last_fetched_at?: string;
	created_at: string;
	updated_at: string;
}

export interface FeedSource {
	id: string;
	source_type:
		| "internal_user"
		| "internal_channel"
		| "internal_collection"
		| "external_rss";
	source_id?: string;
	rss_url?: string;
	platform?: "youtube" | "bilibili" | "github";
	content_type?: "video" | "project_update";
	hash: string;
	title?: string;
	description?: string;
	summary?: string;
	language_code?: string;
	full_text_enabled?: boolean;
	status?: "healthy" | "degraded" | "failing" | "disabled";
	success_count?: number;
	retry_count?: number;
	failed_count?: number;
	pending_count?: number;
	success_rate?: number;
	cover_url?: string;
	health_status?: "healthy" | "error";
	last_fetched_at?: string;
	fetch_status?: "idle" | "fetching" | "healthy" | "warning" | "blocked";
	fetch_http_status?: number;
	fetch_last_success_at?: string;
	fetch_next_at?: string;
	fetch_consecutive_failures?: number;
	fetch_last_error_code?: string;
	fetch_last_error?: string;
	last_success_at?: string;
	last_failure_at?: string;
	last_error_code?: string;
	last_error?: string;
	last_sync_status?: "success" | "failed" | "idle";
	last_sync_error?: string;
	last_sync_failed_at?: string;
	consecutive_sync_failures?: number;
	created_at: string;
}

export interface FeedSourceDiagnostic {
	id: string;
	feed_source_id: string;
	kind: "rss_fetch_failure" | "rss_fetch_recovered";
	error_code?: string;
	message: string;
	attempt_count: number;
	recovered_at?: string;
	created_at: string;
}

export interface FeedExploreRecentItem {
	id: string;
	title: string;
	publishedAt?: string;
}

export interface FeedExploreSource {
	id: string;
	title: string;
	rssUrl?: string;
	coverUrl?: string;
	category: FeedSourceCategory;
	language_code?: string;
	subscriptionCount: number;
	recentItemCount: number;
	lastPublishedAt?: string;
	subscribed: boolean;
	recentItems: FeedExploreRecentItem[];
	description?: string;
	updateFrequencyLabel?: string;
	bookmarkCount?: number;
	readCount?: number;
	platform?: "youtube" | "bilibili" | "github";
	content_type?: "video" | "project_update";
}

export interface FeedRecommendationTheme {
	id: string;
	label: string;
	description: string;
}

export interface SubscriptionGroup {
	id: string;
	user_id: string;
	name: string;
	position?: number;
	created_at: string;
	updated_at: string;
}

export interface FeedStarGroup {
	id: string;
	user_id: string;
	name: string;
	created_at: string;
	updated_at: string;
}

export type SubscriptionHubType = 'all' | 'podcast' | 'video' | 'blog' | 'rss'

export interface SubscriptionHubMembership {
	id: string;
	user_id: string;
	subscription_type: SubscriptionHubType;
	group_id: string;
	feed_source_id: string;
	feed_source?: FeedSource;
	title?: string;
	position?: number;
	unread_count?: number;
	created_at?: string;
	updated_at?: string;
}

export interface SubscriptionHubGroup {
	id: string;
	user_id: string;
	subscription_type: SubscriptionHubType;
	name: string;
	position?: number;
	memberships: SubscriptionHubMembership[];
	created_at?: string;
	updated_at?: string;
}

export interface SubscriptionHubTypeNode {
	subscription_type: SubscriptionHubType;
	has_content?: boolean;
	groups: SubscriptionHubGroup[];
}

export interface SubscriptionHubTree {
	types: SubscriptionHubTypeNode[];
}

export interface SubscriptionHubSelection {
	subscriptionType: SubscriptionHubType;
	groupId?: string;
	membershipId?: string;
}

export interface Subscription {
	id: string;
	user_id: string;
	feed_source_id: string;
	feed_source?: FeedSource;
	title?: string;
	subscription_group_id?: string;
	subscription_group?: SubscriptionGroup;
	is_muted?: boolean;
	priority?: "high" | "normal" | "low";
	auto_mark_read?: boolean;
	auto_add_reading_list?: boolean;
	is_paused?: boolean;
	resumed_after?: string;
	position?: number;
	health_status?: "healthy" | "warning" | "error";
	error_message?: string;
	last_checked?: string;
	unread_count?: number;
	created_at: string;
}

export interface SubscriptionSyncResult {
	subscription_id: string;
	feed_source_id: string;
	fetched_items: number;
	new_items: number;
	synced_at: string;
	success: boolean;
	error?: string;
}

export interface SubscriptionSyncSummary {
	total: number;
	succeeded: number;
	failed: number;
	new_items: number;
	results: SubscriptionSyncResult[];
}

export type FeedSubscriptionRuleMatchType =
	| "source_category"
	| "source_ids"
	| "keywords";

export interface FeedSubscriptionRule {
	id: string;
	name: string;
	enabled: boolean;
	position: number;
	match_type: FeedSubscriptionRuleMatchType;
	conditions_json: Record<string, unknown>;
	action_group_id?: string | null;
	action_muted?: boolean | null;
	action_auto_mark_read?: boolean | null;
	action_auto_add_reading_list?: boolean | null;
	created_at?: string;
	updated_at?: string;
}

export interface ApplySubscriptionRulesSummary {
	scanned_count: number;
	updated_count: number;
	group_changed_count: number;
	muted_changed_count: number;
	auto_mark_read_changed_count: number;
	auto_add_reading_list_changed_count: number;
}

export interface FeedItem {
	id: string;
	feed_source_id: string;
	feed_source?: FeedSource;
	guid: string;
	title: string;
	language_code?: string;
	link: string;
	summary: string;
	author: string;
	published_at: string;
	fetched_at: string;
	enclosure_url?: string;
	enclosure_type?: string;
	duration?: string;
	image_url?: string;
	image_caption?: string;
	content?: string;
	content_html?: string;
	feed_content_html?: string;
	content_source?: "feed" | "page" | "summary" | "full_text";
	reader_quality_score?: number;
	read_count?: number;
	bookmark_count?: number;
	rating_score?: number;
	rating_count?: number;
	viewer_rating?: number | null;
	reader_quality_flags?: string[];
	reader_version?: number;
	full_text_html?: string;
	full_text_status?:
		| "disabled"
		| "pending"
		| "fetching"
		| "retry"
		| "success"
		| "failed";
	full_text_error_code?: string;
	full_text_attempt_count?: number;
	last_full_text_attempt_at?: string;
	next_full_text_attempt_at?: string;
	full_text_fetched_at?: string;
	full_text_word_count?: number;
	is_duplicate?: boolean;
	duplicate_count?: number;
	duplicate_of_id?: string;
	duplicate_sources?: string[];
	duplicate_item_ids?: string[];
	is_starred?: boolean;
}

export type FeedReaderVariant = "rss" | "full_text" | "summary";

export interface FeedReaderContent {
	html: string;
}

export interface FeedReaderFullText {
	status: NonNullable<FeedItem["full_text_status"]>;
	html?: string;
	word_count?: number;
}

export interface FeedItemReader {
	default_variant: FeedReaderVariant;
	rss: FeedReaderContent | null;
	full_text: FeedReaderFullText;
}

export interface FeedItemDetail {
	item: FeedItem;
	reader: FeedItemReader;
}

export interface StarredFeedItem {
	id: string;
	feed_source_id?: string;
	guid?: string;
	title: string;
	language_code?: string;
	link: string;
	summary: string;
	author: string;
	published_at: string;
	fetched_at?: string;
	image_url?: string;
	enclosure_url?: string;
	enclosure_type?: string;
	duration?: string;
	full_text_html?: string;
	full_text_status?: FeedItem["full_text_status"];
	content_html?: string;
	content_source?: FeedItem["content_source"];
	reader_quality_score?: number;
	reader_quality_flags?: string[];
	reader_version?: number;
	source_title: string;
	source_site_url?: string;
	source_image_url?: string;
	group_id?: string | null;
	is_read?: boolean;
}

// Unified timeline item returned by GET /api/feed/timeline
export interface TimelineItem {
	type: "post" | "short_note" | "feed_item" | "project_update" | "podcast_episode" | "video" | "orbit_item";
	post?: Post;
	short_note?: ShortNote;
	feed_item?: FeedItem;
	podcast_episode?: PodcastEpisode;
	video?: Video;
	orbit_item?: OrbitItem;
	published_at: string;
	is_read: boolean;
	priority_reason?: "subscription_priority_high" | "subscription_priority_normal" | "subscription_priority_low";
}

export interface FeedArticleSource {
	type: "internal_channel" | "external_rss";
	id: string;
	title: string;
	rssUrl?: string;
	imageUrl?: string;
	subscriptionId?: string;
	subscribed: boolean;
	healthStatus?: "healthy" | "warning" | "error";
	lastCheckedAt?: string;
	itemCount?: number;
	platform?: "youtube" | "bilibili" | "github";
	contentType?: "video" | "project_update";
}

// ===== Bookmark Types =====

