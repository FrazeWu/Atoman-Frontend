export type MusicEntryStatus = 'open' | 'confirmed' | 'disputed'

export interface ArtistAlias {
  id: string
  artist_id: string
  alias: string
  is_main_name: boolean
  created_at: string
}

export interface LyricAnnotation {
  id: string
  song_id: string
  line_number: number
  content: string
  user?: User
  created_at: string
}

export interface Artist {
  id: number | string;
  name: string;
  bio?: string;
  image_url?: string;
  nationality?: string;
  birth_year?: number;
  death_year?: number;
  members?: string;
  entry_status?: MusicEntryStatus;
  aliases?: ArtistAlias[];
  created_at?: string;
  updated_at?: string;
}

export interface Album {
  id: number;
  title: string;
  year?: number;
  release_date?: string;
  cover_url?: string;
  cover_source?: 'local' | 's3';
  status: 'open' | 'closed' | 'pending' | 'approved' | 'rejected';
  album_type?: string;
  entry_status?: MusicEntryStatus;
  uploaded_by?: number;
  artists?: Artist[];
  songs?: Song[];
  created_at?: string;
  updated_at?: string;
}

export interface Song {
  id: number | string;
  title: string;
  artist: string;
  album: string;
  album_id: number | string;
  year: number;
  release_date: string;
  lyrics: string;
  audio_url: string;
  audio_source?: 'local' | 's3';
  cover_url: string;
  cover_source?: 'local' | 's3';
  track_number?: number;
  status: 'open' | 'closed' | 'pending' | 'approved' | 'rejected';
  uploaded_by?: number;
  artists?: Artist[];
}

export interface SongCorrection {
  id: number;
  song_id: number;
  song?: Song;
  user_id?: number;
  user?: User;
  status: 'pending' | 'approved' | 'rejected';
  field_name: string;
  current_value: string;
  corrected_value: string;
  reason?: string;
  created_at: string;
  approved_at?: string;
  approved_by?: number;
  rejected_at?: string;
  rejected_by?: number;
}

export interface AlbumCorrection {
  id: number;
  album_id: number;
  album?: Album;
  user_id?: number;
  user?: User;
  status: 'pending' | 'approved' | 'rejected';
  original_title?: string;
  original_cover_url?: string;
  original_release_date?: string;
  original_artist_ids?: string;
  corrected_title?: string;
  corrected_cover_url?: string;
  corrected_cover_source?: 'local' | 's3';
  corrected_release_date?: string;
  corrected_artist_ids?: string;
  reason?: string;
  created_at: string;
  approved_at?: string;
  approved_by?: number;
  rejected_at?: string;
  rejected_by?: number;
}

export interface ArtistCorrection {
  id: string
  artist_id: string
  artist?: Artist
  user_id?: string
  user?: User
  description: string
  reason?: string
  status: 'pending' | 'approved' | 'rejected'
  approved_by?: string
  approved_at?: string
  created_at: string
  updated_at: string
}

export type RepeatMode = 'none' | 'one' | 'all'

export interface User {
  id?: number
  uuid?: string
  username: string
  email: string
  role?: 'user' | 'admin' | 'owner'
  display_name?: string
  avatar_url?: string
  bio?: string
  website?: string
  location?: string
  onboarding_completed_at?: string | null
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

// ===== Blog Types =====

export interface Channel {
  id: string
  user_id: string
  user?: User
  name: string
  slug: string
  description?: string
  cover_url?: string
  is_default?: boolean
  created_at: string
  updated_at: string
}

export interface Collection {
  id: string
  channel_id: string
  channel?: Channel
  name: string
  is_default?: boolean
  description?: string
  cover_url?: string
  created_at: string
  updated_at: string
}

export interface Post {
  id: string
  user_id: string
  user?: User
  channel_id?: string
  channel?: Channel
  title: string
  content: string
  summary?: string
  cover_url?: string
  status: 'draft' | 'published'
  visibility: 'public' | 'followers' | 'private'
  allow_comments: boolean
  pinned: boolean
  collections?: Collection[]
  likes_count?: number
  comments_count?: number
  created_at: string
  updated_at: string
}

export interface BlogDraft {
  id: string
  user_id: string
  context_key: string
  source_post_id?: string
  title: string
  content: string
  summary?: string
  cover_url?: string
  visibility: 'public' | 'followers' | 'private'
  allow_comments: boolean
  channel_id?: string
  collection_ids: string[]
  created_at: string
  updated_at: string
}

export interface Comment {
  id: string
  target_type?: 'post' | 'video'
  target_id?: string
  post_id?: string
  user_id?: string | null
  user?: User
  guest_name?: string
  content: string
  timestamp_sec?: number | null
  status: 'visible' | 'hidden'
  created_at: string
  updated_at: string
}

export type InteractionModule = 'blog' | 'forum' | 'videos'
export type InteractionTargetType = 'post' | 'forum_topic' | 'video'

export interface InteractionUserRef {
  id?: string
  username: string
  display_name?: string
  avatar_url?: string
}

export interface InteractionComment {
  id: string
  content: string
  created_at: string
  root_comment_id?: string | null
  parent_comment_id?: string | null
  reply_to_user?: InteractionUserRef | null
  user?: InteractionUserRef | null
  replies?: InteractionComment[]
  timestamp_sec?: number | null
}

export interface Like {
  id: string
  user_id: string
  target_type: 'post' | 'comment'
  target_id: string
  created_at: string
}

// ===== Feed / Types =====

export interface FeedDiscoveryCandidate {
  title: string
  feed_url: string
  site_url?: string
  kind?: string
  score: number
  reason?: string
  is_default: boolean
}

export type FeedSourceProvider = 'rss' | 'rsshub' | 'internal'

export type ResolvedSubscriptionStatus =
  | 'already_subscribed'
  | 'existing_source'
  | 'new_source'
  | 'multiple_candidates'
  | 'not_found'
  | 'invalid'

export interface ResolvedSubscriptionSource {
  id?: string
  provider: FeedSourceProvider
  source_type: 'external_rss' | 'internal_user' | 'internal_channel' | 'internal_collection'
  category?: FeedSourceCategory
  title: string
  rss_url: string
  site_url?: string
  canonical_url: string
}

export interface ResolvedSubscriptionCandidate extends FeedDiscoveryCandidate {
  status: ResolvedSubscriptionStatus
  source?: ResolvedSubscriptionSource | null
  subscription?: Subscription
}

export interface ResolvedSubscriptionInput {
  status: ResolvedSubscriptionStatus
  source?: ResolvedSubscriptionSource | null
  subscription?: Subscription | null
  candidates: ResolvedSubscriptionCandidate[]
  message: string
}

export type FeedSourceCategory = 'blog' | 'news' | 'social' | 'video' | 'forum' | 'podcast'

export interface AutoAddSubscriptionPayload {
  input: string
  candidate_feed_url?: string
  title?: string
  group_id?: string
  category?: FeedSourceCategory
}

export interface AdminFeedSourceRow {
  id: string
  source_type: 'external_rss' | 'internal_user' | 'internal_channel' | 'internal_collection'
  provider: FeedSourceProvider
  title: string
  rss_url?: string
  canonical_url?: string
  site_url?: string
  hidden: boolean
  health_status: 'healthy' | 'warning' | 'error' | 'failed' | 'stale'
  last_error?: string
  last_fetched_at?: string
  created_at: string
  updated_at: string
}

export interface FeedSource {
  id: string
  source_type: 'internal_user' | 'internal_channel' | 'internal_collection' | 'external_rss'
  source_id?: string
  rss_url?: string
  hash: string
  title?: string
  full_text_enabled?: boolean
  status?: 'healthy' | 'degraded' | 'failing' | 'disabled'
  success_count?: number
  retry_count?: number
  failed_count?: number
  pending_count?: number
  success_rate?: number
  cover_url?: string
  last_fetched_at?: string
  last_success_at?: string
  last_failure_at?: string
  last_error_code?: string
  last_error?: string
  last_sync_status?: 'success' | 'failed' | 'idle'
  last_sync_error?: string
  last_sync_failed_at?: string
  consecutive_sync_failures?: number
  created_at: string
}

export interface FeedExploreRecentItem {
  id: string
  title: string
  publishedAt?: string
}

export interface FeedExploreSource {
  id: string
  title: string
  rssUrl?: string
  category: FeedSourceCategory
  subscriptionCount: number
  recentItemCount: number
  lastPublishedAt?: string
  subscribed: boolean
  recentItems: FeedExploreRecentItem[]
  description?: string
  updateFrequencyLabel?: string
  bookmarkCount?: number
  readCount?: number
}

export interface FeedRecommendationTheme {
  id: string
  label: string
  description: string
}

export interface SubscriptionGroup {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface FeedStarGroup {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  user_id: string
  feed_source_id: string
  feed_source?: FeedSource
  title?: string
  subscription_group_id?: string
  subscription_group?: SubscriptionGroup
  is_muted?: boolean
  auto_mark_read?: boolean
  auto_add_reading_list?: boolean
  health_status?: 'healthy' | 'warning' | 'error'
  error_message?: string
  last_checked?: string
  created_at: string
}

export type FeedSubscriptionRuleMatchType = 'source_category' | 'source_ids' | 'keywords'

export interface FeedSubscriptionRule {
  id: string
  name: string
  enabled: boolean
  position: number
  match_type: FeedSubscriptionRuleMatchType
  conditions_json: Record<string, unknown>
  action_group_id?: string | null
  action_muted?: boolean | null
  action_auto_mark_read?: boolean | null
  action_auto_add_reading_list?: boolean | null
  created_at?: string
  updated_at?: string
}

export interface ApplySubscriptionRulesSummary {
  scanned_count: number
  updated_count: number
  group_changed_count: number
  muted_changed_count: number
  auto_mark_read_changed_count: number
  auto_add_reading_list_changed_count: number
}

export interface FeedItem {
  id: string
  feed_source_id: string
  feed_source?: FeedSource
  guid: string
  title: string
  link: string
  summary: string
  author: string
  published_at: string
  fetched_at: string
  enclosure_url?: string
  enclosure_type?: string
  duration?: string
  image_url?: string
  image_caption?: string
  content?: string
  content_html?: string
  content_source?: 'full_text' | 'summary'
  full_text_html?: string
  full_text_status?: 'disabled' | 'pending' | 'fetching' | 'retry' | 'success' | 'failed'
  full_text_error_code?: string
  full_text_error?: string
  full_text_attempt_count?: number
  last_full_text_attempt_at?: string
  next_full_text_attempt_at?: string
  full_text_fetched_at?: string
  full_text_word_count?: number
  is_duplicate?: boolean
  duplicate_count?: number
  duplicate_of_id?: string
  duplicate_sources?: string[]
  is_starred?: boolean
}

export interface StarredFeedItem {
  id: string
  feed_source_id?: string
  guid?: string
  title: string
  link: string
  summary: string
  author: string
  published_at: string
  fetched_at?: string
  image_url?: string
  enclosure_url?: string
  enclosure_type?: string
  duration?: string
  full_text_html?: string
  full_text_status?: string
  source_title: string
  source_site_url?: string
  source_image_url?: string
  group_id?: string | null
}

// Unified timeline item returned by GET /api/feed/timeline
export interface TimelineItem {
  type: 'post' | 'feed_item' | 'orbit_item'
  post?: Post
  feed_item?: FeedItem
  orbit_item?: OrbitItem
  published_at: string
  is_read: boolean
}

export interface FeedArticleSource {
  type: 'internal_channel' | 'external_rss'
  id: string
  title: string
  rssUrl?: string
  subscriptionId?: string
  subscribed: boolean
}

// ===== Bookmark Types =====

export interface BookmarkFolder {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Bookmark {
  id: string
  user_id: string
  post_id: string
  post?: Post
  bookmark_folder_id?: string
  bookmark_folder?: BookmarkFolder
  created_at: string
}

// ===== Orbit Types =====

export interface OrbitItem {
  id: string
  feed_source_id: string
  feed_source?: FeedSource
  guid: string
  title: string
  link: string
  summary: string
  author: string
  published_at: string
  fetched_at: string
  enclosure_url?: string
  enclosure_type?: string
  duration?: string
  image_url?: string
  is_starred?: boolean
}

// ===== Forum Types =====

export interface ForumCategory {
  id: string
  name: string
  description?: string
  color: string
  topic_count?: number
  created_at: string
}

export interface ForumTopic {
  id: string
  user_id: string
  user?: User
  category_id: string
  category?: ForumCategory
  title: string
  content: string          // raw Markdown
  tags: string[]
  pinned: boolean
  featured: boolean
  closed: boolean
  is_solved?: boolean
  solved_reply_id?: string
  reply_count: number
  like_count: number
  view_count: number
  last_reply_at?: string
  is_liked: boolean
  is_bookmarked: boolean
  created_at: string
  updated_at: string
}

export interface ForumReply {
  id: string
  topic_id: string
  user_id: string
  user?: User
  parent_reply_id?: string // quoted reply id
  content: string          // raw Markdown
  path: string
  floor_number: number
  depth?: number
  is_solved?: boolean
  like_count: number
  is_liked: boolean
  created_at: string
  updated_at: string
}

export interface ForumDraft {
  id?: string
  context_key: string
  title?: string
  content: string
  tags?: string
  updated_at?: string
}

// ===== Profile Types =====

export interface UserProfile {
  id: number
  uuid: string
  username: string
  display_name?: string
  avatar_url?: string
  bio?: string
  website?: string
  role: string
  followers_count?: number
  following_count?: number
  posts_count?: number
  created_at: string
}

export interface Notification {
  id: string
  recipient_id: string
  actor_id?: string | null
  actor?: User | null
  type: 'forum_reply' | 'forum_mention' | 'forum_solved' | 'forum_like'
  source_type: string
  source_id: string
  meta: {
    topic_id?: string
    topic_title?: string
    reply_excerpt?: string
    actor_count?: number
    recent_actors?: string[]
    [key: string]: any
  }
  read_at?: string | null
  created_at: string
  updated_at: string
}

export interface DMConversation {
  conversation_id: string
  other_username: string
  other_user_id: string
  last_message_at?: string | null
  preview: string
  unread_count: number
}

export interface DMMessage {
  id: string
  conversation_id: string
  sender_id: string
  sender?: User
  content: string
  image_url?: string
  read_at?: string | null
  created_at: string
  updated_at: string
}

export interface UserSettings {
  user_id: string
  private_profile: boolean
  dm_permission?: 'anyone' | 'following_only' | 'one_before_reply'
}

export interface DMRealtimePayload {
  conversation_id: string
  message_id: string
  sender_id: string
  sender_username: string
  content: string
  image_url: string
  created_at: string
}

export type InboxTab = 'reply' | 'like' | 'mention' | 'dm'
export type NotificationFilterType = '' | 'forum_reply' | 'forum_like' | 'forum_mention'
export type DMPermission = 'anyone' | 'following_only' | 'one_before_reply'

// ===== Debate Types =====

export type DebateStatus = 'open' | 'concluded' | 'archived'
export type ArgumentType = 'support' | 'oppose' | 'neutral' | 'evidence' | 'question' | 'counter'

export interface Debate {
  id: string
  user_id: string
  user?: User
  title: string
  description: string
  content: string
  status: DebateStatus
  tags: string[]
  view_count: number
  argument_count: number
  vote_count: number
  conclusion_type?: 'yes' | 'no' | 'inconclusive' | ''
  conclusion_summary?: string
  conclude_vote_count?: number
  conclude_threshold?: number
  created_at: string
  updated_at: string
  concluded_at?: string
}

export interface Argument {
  id: string
  debate_id: string
  debate?: Debate
  parent_id?: string // quoted argument id
  parent?: Argument
  user_id: string
  user?: User
  content: string
  argument_type: ArgumentType
  vote_count: number
  references?: Argument[]
  referenced_debates?: Debate[]
  is_concluded: boolean
  conclusion?: string
  source_url?: string
  source_title?: string
  source_excerpt?: string
  is_folded?: boolean
  fold_note?: string
  created_at: string
  updated_at: string
}

export interface DebateVote {
  id: string
  argument_id: string
  argument?: Argument
  user_id: string
  user?: User
  vote_type: number // +1 or -1
  created_at: string
  updated_at: string
}

export interface VoteHistory {
  id: string
  argument_id: string
  user_id: string
  old_vote_type: number
  new_vote_type: number
  created_at: string
}

export interface TimelineEvent {
  id: string
  user_id: string
  user?: User
  title: string
  description: string
  content: string
  event_date: string
  end_date?: string
  location: string
  latitude?: number
  longitude?: number
  source: string
  category: string
  tags: string[]
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface TimelinePerson {
  id: string
  user_id: string
  user?: User
  name: string
  bio: string
  birth_date?: string
  death_date?: string
  tags: string[]
  is_public: boolean
  locations?: PersonLocation[]
  created_at: string
  updated_at: string
}

export interface PersonLocation {
  id: string
  person_id: string
  date: string
  end_date?: string
  place_name: string
  latitude: number
  longitude: number
  source: string
  note: string
  created_at: string
  updated_at: string
}

export interface TimelineRevision {
  id: string
  event_id: string
  editor_id: string
  editor?: User
  title: string
  description: string
  content: string
  event_date: string
  end_date?: string
  location: string
  source: string
  category: string
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface PodcastEpisode {
  id: string
  post_id: string
  post?: Post
  collections?: Collection[]
  channel_id: string
  channel?: Channel
  audio_url: string
  duration_sec: number
  episode_cover_url: string
  season_number: number
  episode_number: number
  created_at: string
  updated_at: string
}

export interface VideoTag {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export type VideoProcessingStatus = 'none' | 'pending' | 'processing' | 'ready' | 'failed'

export interface VideoPreviewThumbnail {
  time_sec: number
  url: string
  width: number
  height: number
}

export interface Video {
  id: string
  channel_id: string | null
  channel?: Channel
  user_id: string
  user?: User
  title: string
  description: string
  storage_type: 'local' | 'external'
  video_url: string
  thumbnail_url: string
  duration_sec: number
  visibility: 'public' | 'followers' | 'private'
  status: 'draft' | 'published'
  view_count: number
  subtitle_url?: string
  processing_status?: VideoProcessingStatus
  processing_error?: string
  preview_thumbnails?: VideoPreviewThumbnail[]
  tags: VideoTag[]
  collections?: Collection[]
  created_at: string
  updated_at: string
}
