/** A decoded response body returned without an envelope. */
export type ApiPayload<T> = T;

/** The standard success envelope returned by the v1 API. */
export type ApiSuccess<T, M = Record<string, unknown>> = {
	data: T;
	meta?: M;
};

export type ApiEnvelope<T, M = Record<string, unknown>> = ApiSuccess<T, M>;

export type PaginationMeta = {
	page: number;
	page_size: number;
	total: number;
	has_more: boolean;
};

export type ApiList<T> = {
	data: T[];
	meta: PaginationMeta;
};

export type ApiError = {
	code?: string;
	message?: string;
	details?: Record<string, unknown>;
};

export type ApiErrorEnvelope = {
	error?: ApiError | string;
	code?: string;
	message?: string;
	details?: Record<string, unknown>;
};

export type ApiSessionPayload = {
	csrf_token?: string;
	data?: {
		csrf_token?: string;
	};
};

export type ApiErrorDetails = {
	code: string;
	message: string;
	details: Record<string, unknown>;
};

export type UploadPurpose = "blog.image" | "music.cover" | "music.audio";

export type UploadAsset = {
	id?: string;
	url: string;
	key: string;
	content_type: string;
	size: number;
};
