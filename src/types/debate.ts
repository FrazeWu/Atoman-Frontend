import type { User } from "./user";

export type DebateVoteDirection = "yes" | "no";
export type DebateReferenceState = "active" | "stale" | "unavailable";
export type DebateResourceKind =
	| "post"
	| "thread"
	| "debate"
	| "feed"
	| "article"
	| "artist"
	| "album"
	| "song"
	| "playlist"
	| "podcast"
	| "episode"
	| "video"
	| "person"
	| "event"
	| "channel"
	| "collection"
	| "comment";

export type DebateStatus = "active" | "archived";
export type DebateRelationStance = "support" | "oppose";

export interface ContentReferenceTarget {
	type: DebateResourceKind;
	id: string;
	label: string;
	subtitle?: string;
	module?: string;
	path?: string;
	available: boolean;
}

export interface DebateReferenceRelation {
	id: string;
	stance: DebateRelationStance;
	state: DebateReferenceState;
	conclusion_event_id?: string;
	conclusion_direction?: DebateVoteDirection;
}

export interface ContentReference {
	id: string;
	field: string;
	start: number;
	end: number;
	raw: string;
	target: ContentReferenceTarget;
	relation?: DebateReferenceRelation;
}

export interface LegacyDebateReference {
	raw: string;
	kind: DebateResourceKind;
	resource_id: string;
	title: string;
	qualifier?: DebateRelationStance;
	state: DebateReferenceState;
	relation_id?: string;
}

export type DebateReference = ContentReference | LegacyDebateReference;

export interface Debate {
	id: string;
	user_id: string;
	user?: User;
	title: string;
	description: string;
	content: string;
	status: DebateStatus;
	tags: string[];
	view_count: number;
	current_revision_id: string;
	current_conclusion_event_id?: string;
	references: DebateReference[];
	conclusion_type?: DebateVoteDirection | "";
	created_at: string;
	updated_at: string;
}

export interface DebateRevisionSnapshot {
	title: string;
	description: string;
	content: string;
	tags: string[];
}

export interface DebateRevision {
	id: string;
	version_number: number;
	previous_revision_id?: string;
	editor_id: string;
	editor?: User;
	edit_summary: string;
	edit_type: "creation" | "edit" | "revert";
	status: "approved";
	is_current: boolean;
	created_at: string;
	snapshot: DebateRevisionSnapshot;
	references?: DebateReference[];
}

export interface DebateRevisionFieldDiff {
	before: unknown;
	after: unknown;
	changed: boolean;
}

export interface DebateRevisionDiff {
	revision_id: string;
	against_revision_id: string;
	changes: Record<string, DebateRevisionFieldDiff>;
}

export interface DebateVoteSummary {
	yes_votes: number;
	no_votes: number;
	total_votes: number;
	current_direction: DebateVoteDirection | "";
	current_user_vote: DebateVoteDirection | "";
}

export interface DebateConclusionEvent {
	id: string;
	debate_id: string;
	direction: DebateVoteDirection;
	yes_votes: number;
	no_votes: number;
	total_votes: number;
	created_at: string;
	updated_at: string;
}

export interface DebateRelation {
	id: string;
	source_debate_id: string;
	target_debate_id: string;
	stance: DebateRelationStance;
	target_revision_id: string;
	source_conclusion_event_id: string;
	status: DebateReferenceState;
	created_at: string;
	updated_at: string;
}

export interface DebateGraph {
	root_id: string;
	nodes: Debate[];
	relations: DebateRelation[];
	expandable_node_ids: string[];
}

