import type { User } from "./user";

export interface TimelineEvent {
	id: string;
	user_id: string;
	user?: User;
	title: string;
	description: string;
	content: string;
	event_date: string;
	end_date?: string;
	location: string;
	latitude?: number;
	longitude?: number;
	source: string;
	category: string;
	tags: string[];
	is_public: boolean;
	created_at: string;
	updated_at: string;
}

export interface TimelinePerson {
	id: string;
	user_id: string;
	user?: User;
	name: string;
	bio: string;
	birth_date?: string;
	death_date?: string;
	tags: string[];
	is_public: boolean;
	locations?: PersonLocation[];
	created_at: string;
	updated_at: string;
}

export interface PersonLocation {
	id: string;
	person_id: string;
	date: string;
	end_date?: string;
	place_name: string;
	latitude: number;
	longitude: number;
	source: string;
	note: string;
	created_at: string;
	updated_at: string;
}

export interface TimelineRevision {
	id: string;
	event_id: string;
	editor_id: string;
	editor?: User;
	title: string;
	description: string;
	content: string;
	event_date: string;
	end_date?: string;
	location: string;
	source: string;
	category: string;
	is_public: boolean;
	created_at: string;
	updated_at: string;
}

