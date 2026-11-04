import type { ResolvedReference } from "@/api/references";
import type { User } from "./user";

export interface Channel {
	id: string;
	user_id: string;
	user?: User;
	name: string;
	slug: string;
	content_type?: "blog" | "podcast" | "video";
	description?: string;
	cover_url?: string;
	is_default?: boolean;
	created_at: string;
	updated_at: string;
}

export interface Collection {
	id: string;
	channel_id: string;
	channel?: Channel;
	content_type?: "blog" | "podcast" | "video";
	name: string;
	is_default?: boolean;
	description?: string;
	cover_url?: string;
	created_at: string;
	updated_at: string;
}

export type StudioModule = "blog" | "podcast" | "video";
export type StudioVisibility = "public" | "subscribers" | "private";
export type StudioPublishStatus = "published" | "draft";
export type StudioEditorMode = "markdown" | "visual";
export type StudioContentStatus = StudioPublishStatus | "scheduled";

export interface StudioChannel {
	id: string;
	name: string;
	slug: string;
	description: string;
	cover_url: string;
	article_count?: number;
	content_count?: number;
	updated_at?: string;
	status?: string;
}

export interface StudioState {
	current_channel: StudioChannel | null;
	channels: StudioChannel[];
}

export interface StudioCollection {
	id: string;
	channel_id: string;
	content_type: StudioModule;
	name: string;
	description: string;
	cover_url: string;
	is_default: boolean;
	created_at: string;
	updated_at: string;
}

export interface StudioCollectionInput {
	name: string;
	description?: string;
	cover_url?: string;
}

export interface StudioContentFilters {
	q: string;
	status: "" | StudioContentStatus;
	visibility: "" | StudioVisibility;
	collection_id: string;
	issue?: string;
	page: number;
}

export interface StudioCollectionSummary {
	id: string;
	name: string;
}

export interface StudioContentItem {
	id: string;
	module: StudioModule;
	channel_id: string;
	title: string;
	summary: string;
	cover_url: string;
	status: StudioContentStatus;
	visibility: StudioVisibility;
	collection?: StudioCollectionSummary;
	collections: StudioCollectionSummary[];
	collection_conflict?: boolean;
	duration_sec?: number;
	view_count: number;
	metrics?: Record<string, number>;
	processing_status?: string;
	published_at?: string;
	scheduled_at?: string;
	schedule_status?: "pending" | "processing" | "published" | "failed" | "cancelled";
	schedule_timezone?: string;
	schedule_attempts?: number;
	schedule_last_error?: string;
	created_at: string;
	updated_at: string;
}

export interface StudioCollectionContentItem {
	content_id: string;
	id: string;
	module: StudioModule;
	title: string;
	cover_url: string;
	status: StudioContentStatus;
	updated_at: string;
	position: number;
}

export interface StudioCollectionContentCandidate {
	content_id: string;
	id: string;
	module: StudioModule;
	title: string;
	cover_url: string;
	status: StudioContentStatus;
	current_collection_id?: string;
	current_collection_name?: string;
}

export interface StudioCalendarPreflightIssue {
	code: string;
}

export interface StudioCalendarItem {
	content_id: string;
	id: string;
	module: StudioModule;
	title: string;
	scheduled_at: string;
	preflight: StudioCalendarPreflightIssue[];
}

export interface StudioContentIssue {
	code: string;
	count: number;
}

export interface StudioDashboardSection {
	module: StudioModule;
	metrics: Record<string, number>;
	recent: StudioContentItem[];
	issues: StudioContentIssue[];
	error?: string;
}

export interface StudioDashboard {
	channel_subscriber_count: number;
	sections: StudioDashboardSection[];
}

export interface StudioPagination {
	page: number;
	page_size: number;
	total: number;
	has_more?: boolean;
}

export interface StudioAnalyticsPoint {
	date: string;
	metrics: Record<string, number>;
}

export interface StudioAnalyticsContentMetric {
	id: string;
	title: string;
	metrics: Record<string, number>;
}

export interface StudioAnalyticsSourceMetric {
	source: string;
	count: number;
}

export interface StudioAnalyticsPeriod {
	from: string;
	to: string;
	totals: Record<string, number>;
}

export interface StudioAnalyticsFilters {
	collection_id: string;
	content_id: string;
}

export interface StudioAnalytics {
	range: 7 | 28 | 90;
	from: string;
	to: string;
	totals: Record<string, number>;
	previous_period: StudioAnalyticsPeriod;
	trend: StudioAnalyticsPoint[];
	top: StudioAnalyticsContentMetric[];
	sources?: StudioAnalyticsSourceMetric[];
	retention?: {
		consumers: number;
		returning_consumers: number;
		rate: number;
	};
}

export interface StudioGoalMetricOption {
	module: StudioModule;
	metric: string;
	label: string;
}

export interface StudioGoalAction {
	id: string;
	goal_id: string;
	title: string;
	status: "pending" | "completed";
	due_date?: string;
	content_id?: string;
	content_module?: StudioModule;
}

export interface StudioGoal {
	id: string;
	cycle_id: string;
	name: string;
	module: StudioModule;
	metric: string;
	baseline_value: number;
	target_value: number;
	current_value: number;
	actual_value?: number;
	progress: number;
	actions: StudioGoalAction[];
}

export interface StudioGoalReview {
	id: string;
	result: string;
	learning: string;
	next_action: string;
	created_at: string;
}

export interface StudioGoalCycle {
	id: string;
	channel_id: string;
	start_date: string;
	end_date: string;
	timezone: string;
	status: "planned" | "active" | "needs_review" | "reviewed";
	needs_review: boolean;
	goals: StudioGoal[];
	review?: StudioGoalReview;
}

export interface StudioGoals {
	current_cycle?: StudioGoalCycle;
	cycles: StudioGoalCycle[];
	metrics: StudioGoalMetricOption[];
}

export interface StudioInteractionFilters {
	q: string;
	content_id: string;
	unreplied: boolean;
	anchored: boolean;
	handled: "" | "pending" | "handled";
	priority: "" | "normal" | "high";
	page: number;
}

export interface StudioInteractionAuthor {
	id: string;
	username: string;
	display_name: string;
	avatar_url: string;
}

export interface StudioTimeAnchor {
	start: number;
	end: number;
	seconds: number;
}

export interface StudioInteractionItem {
	id: string;
	content_id: string;
	content_title: string;
	target_kind: string;
	author: StudioInteractionAuthor;
	content: string;
	reply_count: number;
	replied: boolean;
	pinned: boolean;
	handled: boolean;
	priority: "normal" | "high";
	time_anchors: StudioTimeAnchor[];
	created_at: string;
}

export interface StudioReplyTemplate {
	id: string;
	channel_id: string;
	name: string;
	content: string;
	created_at: string;
	updated_at: string;
}

export interface StudioSettingsInput {
	default_collection_id: string | null;
	default_visibility: StudioVisibility;
	default_publish_status: StudioPublishStatus;
	autoplay_enabled: boolean;
	editor_mode?: StudioEditorMode;
}

export interface StudioSettings extends StudioSettingsInput {
	channel_id: string;
	module: StudioModule;
}

import type { Post, PostCategory, PostTag, PostCitation, PostListFilter, PostSummary } from '@/entities/post/model/types';
export type { Post, PostCategory, PostTag, PostCitation, PostListFilter, PostSummary };

export interface ShortNoteMedia {
	id: string;
	url: string;
	position: number;
}

export interface ShortNoteMediaAttachment {
	type: 'song' | 'album' | 'video';
	id: string;
	title: string;
	subtitle?: string;
	cover_url?: string;
	audio_url?: string;
	duration?: number;
	artist?: string;
	album_id?: string;
	album_title?: string;
	year?: number;
	song_count?: number;
}

export interface ShortNote {
	id: string;
	user_id: string;
	user?: User;
	content: string;
	media: ShortNoteMedia[];
	media_attachment?: ShortNoteMediaAttachment;
	media_attachment_type?: string;
	media_attachment_id?: string;
	likes_count: number;
	dislikes_count?: number;
	vote_score?: number;
	viewer_vote?: "up" | "down" | "none";
	comments_count: number;
	liked: boolean;
	edited: boolean;
	created_at: string;
	updated_at: string;
}

export interface BlogContentVersion {
	id: string;
	content_id: string;
	version: number;
	editor_id: string;
	title: string;
	content: string;
	summary?: string;
	cover_url?: string;
	visibility: "public" | "followers" | "private";
	content_collection_id: string;
	published_at?: string;
	created_at: string;
	updated_at: string;
}

export interface BlogDraft {
	id: string;
	user_id: string;
	context_key: string;
	source_content_id?: string;
	title: string;
	content: string;
	summary?: string;
	cover_url?: string;
	visibility: "public" | "followers" | "private";
	allow_comments?: boolean;
	channel_id?: string;
	collection_id?: string;
	tags?: string[];
	created_at: string;
	updated_at: string;
}

export interface Comment {
	id: string;
	target_type?: "post" | "video" | "podcast_episode";
	target_id?: string;
	post_id?: string;
	user_id?: string | null;
	user?: User;
	guest_name?: string;
	content: string;
	timestamp_sec?: number | null;
	status: "visible" | "hidden";
	created_at: string;
	updated_at: string;
}

export type InteractionModule = "blog" | "forum" | "videos";
export type InteractionTargetType =
	| "post"
	| "short_note"
	| "forum_topic"
	| "video";

export interface InteractionUserRef {
	id?: string | number;
	uuid?: string;
	username: string;
	display_name?: string;
	avatar_url?: string;
}

export interface InteractionComment {
	id: string;
	content: string;
	created_at: string;
	user_id?: string | null;
	root_comment_id?: string | null;
	parent_comment_id?: string | null;
	reply_to_user?: InteractionUserRef | null;
	user?: InteractionUserRef | null;
	replies?: InteractionComment[];
	timestamp_sec?: number | null;
	references?: ResolvedReference[];
}

export interface Like {
	id: string;
	user_id: string;
	target_type: "post" | "comment";
	target_id: string;
	created_at: string;
}

// ===== Feed / Types =====

export interface BlogPostVersion {
	version: number;
	title: string;
	summary?: string;
	content?: string;
	created_at: string;
}

