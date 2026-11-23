import type { ResolvedReference } from "@/api/reference/references";
import type { User } from "./user";

export type DebateVoteDirection = "yes" | "no";
export type DebateReferenceState = "active" | "stale" | "unavailable" | "rejected";
export type DebateEntryType = "claim" | "evidence" | "rebuttal";
export type DebateEntryStance = "support" | "oppose" | "neutral";
export type DebateEntryStatus = "active" | "rejected";
export type DebateEvidenceRating = "sufficient" | "partial" | "insufficient";
export type DebateChallengeTargetType = "relation" | "reference" | "entry";
export type DebateChallengeReasonCode =
	| "mismatch"
	| "outdated"
	| "low_reliability"
	| "irrelevant";
export type DebateChallengeStatus = "open" | "upheld" | "dismissed";
export type DebateChallengeVoteDecision = "uphold" | "dismiss";
export type DebateResourceKind =
	| "post"
	| "short_note"
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
	excerpt?: string;
	source_name?: string;
	published_at?: string;
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

export interface DebateReferenceChallenge {
	id: string;
	status: DebateChallengeStatus;
	reason_code: DebateChallengeReasonCode;
	uphold_votes: number;
	dismiss_votes: number;
}

export interface ContentReference {
	id: string;
	field: string;
	start: number;
	end: number;
	raw: string;
	target: ContentReferenceTarget;
	relation?: DebateReferenceRelation;
	challenge?: DebateReferenceChallenge;
}

export interface DebateStats {
	claim_count: number;
	active_evidence_count: number;
	rebuttal_count: number;
	vote_count: number;
	evidence_sufficient: number;
	evidence_partial: number;
	evidence_insufficient: number;
	evidence_weak: boolean;
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
	stats?: DebateStats;
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
	conclusion_min_votes?: number;
	conclusion_threshold_percent?: number;
	evidence_sufficient?: number;
	evidence_partial?: number;
	evidence_insufficient?: number;
	evidence_total?: number;
	current_user_evidence_vote?: DebateEvidenceRating | "";
	active_evidence_count?: number;
	evidence_weak?: boolean;
}

export interface DebateConclusionEvent {
	id: string;
	debate_id: string;
	direction: DebateVoteDirection;
	yes_votes: number;
	no_votes: number;
	total_votes: number;
	evidence_sufficient?: number;
	evidence_partial?: number;
	evidence_insufficient?: number;
	active_evidence_count?: number;
	evidence_weak?: boolean;
	created_at: string;
	updated_at: string;
}

export interface DebateEntry {
	id: string;
	debate_id: string;
	parent_id?: string | null;
	user_id: string;
	user?: User;
	entry_type: DebateEntryType;
	stance: DebateEntryStance;
	title: string;
	content: string;
	status: DebateEntryStatus;
	rejected_challenge_id?: string | null;
	references: ResolvedReference[];
	open_challenge?: DebateReferenceChallenge;
	created_at: string;
	updated_at: string;
}

export interface CreateDebateEntryInput {
	parent_id?: string;
	entry_type: DebateEntryType;
	stance?: DebateEntryStance;
	title?: string;
	content: string;
}

export interface UpdateDebateEntryInput {
	stance?: DebateEntryStance;
	title?: string;
	content: string;
}

export interface DebateChallenge {
	id: string;
	debate_id: string;
	target_type: DebateChallengeTargetType;
	target_id: string;
	target_label?: string;
	target_preview?: string;
	created_by: string;
	creator?: User;
	reason_code: DebateChallengeReasonCode;
	rationale: string;
	references: ResolvedReference[];
	status: DebateChallengeStatus;
	uphold_votes: number;
	dismiss_votes: number;
	current_user_vote?: DebateChallengeVoteDecision | "";
	min_votes: number;
	threshold_percent: number;
	resolved_at?: string | null;
	created_at: string;
	updated_at: string;
}

export interface CreateDebateChallengeInput {
	target_type: DebateChallengeTargetType;
	target_id: string;
	reason_code: DebateChallengeReasonCode;
	rationale: string;
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

