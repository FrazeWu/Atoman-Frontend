import { apiRequest, apiRequestResult } from "@/api/client";
import { ref } from "vue";
import { defineStore } from "pinia";

import { useApi } from "@/composables/useApi";

export interface AdminFeedFulltextHealth {
	enabled_sources: number;
	disabled_sources: number;
	pending_items: number;
	fetching_items: number;
	retry_items: number;
	success_items: number;
	failed_items: number;
	success_rate: number;
	reader_ready_items?: number;
	reader_quality_pass_items?: number;
	reader_quality_pass_rate?: number;
	reader_feed_items?: number;
	reader_page_items?: number;
	reader_summary_items?: number;
	pending_over_7d?: number;
	reader_crawl_pending?: number;
	reader_crawl_last_run_at?: string;
	reader_crawl_last_scanned?: number;
	reader_crawl_last_updated?: number;
	reader_crawl_last_requeued?: number;
	reader_crawl_last_skipped?: number;
	feedback_counts?: {
		missing: number;
		layout: number;
		image: number;
		noise: number;
	};
	enabled: boolean;
	concurrency: number;
	timeout_seconds: number;
	max_attempts: number;
	latest_success_at?: string;
	latest_failure_at?: string;
	oldest_pending_at?: string;
}

export interface AdminFeedFulltextSettings {
	auto_sync_enabled: boolean;
	auto_sync_interval_minutes: number;
	reader_crawl_enabled: boolean;
	reader_crawl_days: number;
	reader_crawl_batch_size: number;
}

export interface AdminFeedCrawlResult {
	scanned: number;
	updated: number;
	requeued: number;
	skipped: number;
	worker_notified: boolean;
}

export interface AdminFeedOPMLImportResult {
	message: string;
	imported: number;
	reused: number;
	failed: number;
	failed_sources?: { url: string; reason: string }[];
}

export interface AdminFeedSourceImpact {
	subscriptions: number;
	feed_items: number;
	read_records: number;
	starred_items: number;
	reading_list_items: number;
}

export interface AdminFeedSourceDiagnostic {
	id: string;
	kind: "failure" | "recovered";
	error_code?: string;
	message: string;
	attempt_count: number;
	created_at: string;
	recovered_at?: string;
}

export interface AdminFeedFulltextSourceRow {
	id: string;
	title: string;
	rss_url: string;
	source_type?: string;
	full_text_enabled: boolean;
	hidden: boolean;
	success_count: number;
	retry_count: number;
	failed_count: number;
	pending_count: number;
	success_rate: number;
	reader_ready_count?: number;
	reader_quality_pass_count?: number;
	summary_fallback_count?: number;
	reader_quality_pass_rate?: number;
	status: "healthy" | "degraded" | "failing" | "disabled";
	last_success_at?: string;
	last_failure_at?: string;
	last_error_code?: string;
	last_error?: string;
	last_sync_status?: "success" | "failed" | "idle";
	last_sync_error?: string;
	last_sync_failed_at?: string;
	consecutive_sync_failures?: number;
	bookmark_count?: number;
	read_count?: number;
	recent_events?: Array<{
		event_type: string;
		created_at: string;
	}>;
}

export interface AdminOnboardingFeedRecommendation {
	id: string;
	feed_source_id: string;
	title: string;
	rss_url: string;
	health_status: string;
	enabled: boolean;
	sort_order: number;
}

export type AdminFeedFulltextItemStatus =
	| "pending"
	| "fetching"
	| "retry"
	| "success"
	| "failed";

export interface AdminFeedFulltextItemRow {
	id: string;
	title: string;
	link: string;
	source_id: string;
	source_title: string;
	full_text_status: AdminFeedFulltextItemStatus;
	attempt_count: number;
	error_code?: string;
	error_message?: string;
	last_attempt_at?: string;
	next_attempt_at?: string;
	published_at: string;
	reader_source?: "feed" | "page" | "summary";
	reader_quality_score?: number;
	reader_quality_flags?: string[];
	reader_version?: number;
}

interface AdminListMeta {
	total: number;
	page: number;
	limit: number;
}

interface FetchSourcesOptions {
	enabled?: boolean;
	hidden?: boolean;
	status?: string;
	q?: string;
	page?: number;
	limit?: number;
}

interface FetchItemsOptions {
	status?: AdminFeedFulltextItemStatus;
	errorCode?: string;
	sourceId?: string;
	q?: string;
	page?: number;
	limit?: number;
}

interface AdminFeedSourcePayload {
	title: string;
	rss_url: string;
}

function buildHeaders(token: string | null, withJson = false): HeadersInit {
	return {
		...(withJson ? { "Content-Type": "application/json" } : {}),
		...(token ? { Authorization: `Bearer ${token}` } : {}),
	};
}

async function parseError(
	response: Response,
	fallback: string,
): Promise<string> {
	const text = await response
		.clone()
		.text()
		.catch(() => "");
	let data: unknown = {};
	try {
		data = text ? JSON.parse(text) : {};
	} catch {
		data = {};
	}
	return parseErrorPayload(data, fallback);
}

function parseErrorPayload(data: unknown, fallback: string): string {
	return typeof data === "object" &&
		data !== null &&
		typeof (data as Record<string, unknown>).error === "string"
		? ((data as Record<string, unknown>).error as string)
		: fallback;
}

export const useAdminFeedFulltextStore = defineStore(
	"adminFeedFulltext",
	() => {
		const api = useApi();

		const health = ref<AdminFeedFulltextHealth | null>(null);
		const settings = ref<AdminFeedFulltextSettings | null>(null);
		const sources = ref<AdminFeedFulltextSourceRow[]>([]);
		const onboardingRecommendations = ref<AdminOnboardingFeedRecommendation[]>(
			[],
		);
		const items = ref<AdminFeedFulltextItemRow[]>([]);
		const sourcesMeta = ref<AdminListMeta>({ total: 0, page: 1, limit: 20 });
		const itemsMeta = ref<AdminListMeta>({ total: 0, page: 1, limit: 20 });
		const loadingHealth = ref(false);
		const loadingSources = ref(false);
		const loadingItems = ref(false);
		const loadingSettings = ref(false);

		async function fetchHealth(token: string | null) {
			loadingHealth.value = true;
			try {
				const result = await apiRequestResult(api.admin.feedFulltext.health, {
					headers: buildHeaders(token),
				});
				if (!result.ok) {
					throw new Error(parseErrorPayload(result.data, "加载概览失败"));
				}
				health.value = result.data;
				return health.value;
			} finally {
				loadingHealth.value = false;
			}
		}

		async function fetchSettings(token: string | null) {
			loadingSettings.value = true;
			try {
				const result = await apiRequestResult(api.admin.feedFulltext.settings, {
					headers: buildHeaders(token),
				});
				if (!result.ok) {
					throw new Error(parseErrorPayload(result.data, "加载抓取设置失败"));
				}
				settings.value = result.data;
				return settings.value;
			} finally {
				loadingSettings.value = false;
			}
		}

		async function fetchSources(
			token: string | null,
			options: FetchSourcesOptions = {},
		) {
			loadingSources.value = true;
			try {
				const query = new URLSearchParams({
					page: String(options.page ?? 1),
					limit: String(options.limit ?? 20),
					sort: "pending_count",
				});
				if (typeof options.enabled === "boolean")
					query.set("enabled", String(options.enabled));
				if (typeof options.hidden === "boolean")
					query.set("hidden", String(options.hidden));
				if (options.status) query.set("status", options.status);
				if (options.q) query.set("q", options.q);
				const result = await apiRequestResult(
					`${api.admin.feedFulltext.sources}?${query.toString()}`,
					{
						headers: buildHeaders(token),
					},
				);
				if (!result.ok) {
					throw new Error(parseErrorPayload(result.data, "加载订阅源失败"));
				}
				const payload = result.data;
				sources.value = payload.data || [];
				sourcesMeta.value = payload.meta || sourcesMeta.value;
				return sources.value;
			} finally {
				loadingSources.value = false;
			}
		}

		async function fetchItems(
			token: string | null,
			options: FetchItemsOptions = {},
		) {
			loadingItems.value = true;
			try {
				const query = new URLSearchParams({
					page: String(options.page ?? 1),
					limit: String(options.limit ?? 20),
					sort: "last_attempt_at",
				});
				if (options.status) query.set("status", options.status);
				if (options.errorCode) query.set("error_code", options.errorCode);
				if (options.sourceId) query.set("source_id", options.sourceId);
				if (options.q) query.set("q", options.q);

				const result = await apiRequestResult(
					`${api.admin.feedFulltext.items}?${query.toString()}`,
					{
						headers: buildHeaders(token),
					},
				);
				if (!result.ok) {
					throw new Error(parseErrorPayload(result.data, "加载条目失败"));
				}
				const payload = result.data;
				items.value = payload.data || [];
				itemsMeta.value = payload.meta || itemsMeta.value;
				return items.value;
			} finally {
				loadingItems.value = false;
			}
		}

		async function fetchOnboardingRecommendations(token: string | null) {
			const result = await apiRequestResult(
				api.admin.feed.onboardingRecommendations,
				{
					headers: buildHeaders(token),
				},
			);
			if (!result.ok)
				throw new Error(parseErrorPayload(result.data, "加载新手推荐失败"));
			const payload = result.data;
			onboardingRecommendations.value = payload.items || [];
			return onboardingRecommendations.value;
		}

		async function createOnboardingRecommendation(
			payload: { feed_source_id: string; enabled: boolean; sort_order: number },
			token: string | null,
		) {
			const result = await apiRequestResult(
				api.admin.feed.onboardingRecommendations,
				{
					method: "POST",
					headers: buildHeaders(token, true),
					body: JSON.stringify(payload),
				},
			);
			if (!result.ok)
				throw new Error(parseErrorPayload(result.data, "添加新手推荐失败"));
			return result.data;
		}

		async function updateOnboardingRecommendation(
			id: string,
			payload: { enabled?: boolean; sort_order?: number },
			token: string | null,
		) {
			const result = await apiRequestResult(
				api.admin.feed.onboardingRecommendation(id),
				{
					method: "PATCH",
					headers: buildHeaders(token, true),
					body: JSON.stringify(payload),
				},
			);
			if (!result.ok)
				throw new Error(parseErrorPayload(result.data, "更新新手推荐失败"));
			return result.data;
		}

		async function deleteOnboardingRecommendation(
			id: string,
			token: string | null,
		) {
			const result = await apiRequestResult(
				api.admin.feed.onboardingRecommendation(id),
				{
					method: "DELETE",
					headers: buildHeaders(token),
				},
			);
			if (!result.ok)
				throw new Error(parseErrorPayload(result.data, "移除新手推荐失败"));
		}

		async function updateSourceEnabled(
			sourceId: string,
			enabled: boolean,
			token: string | null,
		) {
			const result = await apiRequestResult(
				api.admin.feedFulltext.sourceSettings(sourceId),
				{
					method: "PUT",
					headers: buildHeaders(token, true),
					body: JSON.stringify({ full_text_enabled: enabled }),
				},
			);

			if (!result.ok) {
				throw new Error(parseErrorPayload(result.data, "更新订阅源失败"));
			}

			const payload = result.data;
			const row = sources.value.find((source) => source.id === sourceId);
			if (row) {
				row.full_text_enabled = Boolean(payload.full_text_enabled);
				row.status = row.full_text_enabled
					? row.status === "disabled"
						? "healthy"
						: row.status
					: "disabled";
			}
			return payload;
		}

		async function createSource(
			payload: AdminFeedSourcePayload,
			token: string | null,
		) {
			const result = await apiRequestResult(api.admin.feedFulltext.sources, {
				method: "POST",
				headers: buildHeaders(token, true),
				body: JSON.stringify(payload),
			});

			if (!result.ok) {
				throw new Error(parseErrorPayload(result.data, "新增订阅源失败"));
			}

			return result.data;
		}

		async function updateSource(
			sourceId: string,
			payload: AdminFeedSourcePayload,
			token: string | null,
		) {
			const result = await apiRequestResult(
				api.admin.feedFulltext.source(sourceId),
				{
					method: "PUT",
					headers: buildHeaders(token, true),
					body: JSON.stringify(payload),
				},
			);

			if (!result.ok) {
				throw new Error(parseErrorPayload(result.data, "更新订阅源失败"));
			}

			return result.data;
		}

		async function updateSourceVisibility(
			sourceId: string,
			hidden: boolean,
			token: string | null,
		) {
			const result = await apiRequestResult(api.admin.feed.source(sourceId), {
				method: "PATCH",
				headers: buildHeaders(token, true),
				body: JSON.stringify({ hidden }),
			});
			if (!result.ok) {
				throw new Error(parseErrorPayload(result.data, "更新订阅源可见性失败"));
			}
			const row = sources.value.find((source) => source.id === sourceId);
			if (row) row.hidden = hidden;
			return result.data;
		}

		async function fetchSourceImpact(
			sourceId: string,
			token: string | null,
		): Promise<AdminFeedSourceImpact> {
			const result = await apiRequestResult(
				api.admin.feed.sourceImpact(sourceId),
				{
					headers: buildHeaders(token),
				},
			);
			if (!result.ok)
				throw new Error(parseErrorPayload(result.data, "加载影响范围失败"));
			return result.data.data ?? result.data;
		}

		async function fetchSourceDiagnostics(
			sourceId: string,
			token: string | null,
		): Promise<AdminFeedSourceDiagnostic[]> {
			const result = await apiRequestResult(
				`${api.admin.feed.sourceDiagnostics(sourceId)}?page=1&limit=20`,
				{
					headers: buildHeaders(token),
				},
			);
			if (!result.ok)
				throw new Error(parseErrorPayload(result.data, "加载诊断记录失败"));
			const payload = result.data.data ?? result.data;
			return payload.items ?? payload;
		}

		async function deleteSource(
			sourceId: string,
			confirmTitle: string,
			token: string | null,
		) {
			const result = await apiRequestResult(api.admin.feed.source(sourceId), {
				method: "DELETE",
				headers: buildHeaders(token, true),
				body: JSON.stringify({ confirm_title: confirmTitle }),
			});
			if (!result.ok)
				throw new Error(parseErrorPayload(result.data, "删除订阅源失败"));
			sources.value = sources.value.filter((source) => source.id !== sourceId);
			return result.data;
		}

		async function importGlobalOPML(
			file: File,
			token: string | null,
		): Promise<AdminFeedOPMLImportResult> {
			const formData = new FormData();
			formData.append("file", file);

			const result = await apiRequestResult(api.admin.feed.opmlImport, {
				method: "POST",
				headers: buildHeaders(token),
				body: formData,
			});

			if (!result.ok) {
				throw new Error(parseErrorPayload(result.data, "导入 OPML 失败"));
			}

			return result.data;
		}

		async function retryGlobalOPMLSource(
			payload: { title?: string; url: string },
			token: string | null,
		) {
			const result = await apiRequestResult(api.admin.feed.opmlRetryImport, {
				method: "POST",
				headers: buildHeaders(token, true),
				body: JSON.stringify(payload),
			});
			if (!result.ok) {
				throw new Error(parseErrorPayload(result.data, "重试订阅源失败"));
			}
			return result.data;
		}

		async function exportGlobalOPML(token: string | null): Promise<Blob> {
			const response = await apiRequest(api.admin.feed.opmlExport, {
				headers: buildHeaders(token),
			});

			if (!response.ok) {
				throw new Error(await parseError(response, "导出 OPML 失败"));
			}

			return response.blob();
		}

		async function syncSource(sourceId: string, token: string | null) {
			const result = await apiRequestResult(
				api.admin.feedFulltext.syncSource(sourceId),
				{
					method: "POST",
					headers: buildHeaders(token),
				},
			);

			if (!result.ok) {
				throw new Error(parseErrorPayload(result.data, "手工爬取失败"));
			}

			return result.data;
		}

		async function retryItem(itemId: string, token: string | null) {
			const result = await apiRequestResult(
				api.admin.feedFulltext.retryItem(itemId),
				{
					method: "POST",
					headers: buildHeaders(token),
				},
			);

			if (!result.ok) {
				throw new Error(parseErrorPayload(result.data, "重试条目失败"));
			}

			const payload = result.data;
			const row = items.value.find((item) => item.id === itemId);
			if (row) {
				row.full_text_status = payload.full_text_status;
				row.next_attempt_at = undefined;
			}
			return payload;
		}

		async function crawlNow(token: string | null): Promise<AdminFeedCrawlResult> {
			const result = await apiRequestResult<AdminFeedCrawlResult>(
				api.admin.feedFulltext.crawl,
				{
					method: "POST",
					headers: buildHeaders(token),
				},
			);
			if (!result.ok) {
				throw new Error(parseErrorPayload(result.data, "启动爬取失败"));
			}
			return result.data;
		}

		async function updateSettings(
			nextSettings: AdminFeedFulltextSettings,
			token: string | null,
		) {
			const result = await apiRequestResult(api.admin.feedFulltext.settings, {
				method: "PUT",
				headers: buildHeaders(token, true),
				body: JSON.stringify(nextSettings),
			});

			if (!result.ok) {
				throw new Error(parseErrorPayload(result.data, "更新抓取设置失败"));
			}

			settings.value = result.data;
			return settings.value;
		}

		return {
			health,
			settings,
			sources,
			onboardingRecommendations,
			items,
			sourcesMeta,
			itemsMeta,
			loadingHealth,
			loadingSources,
			loadingItems,
			loadingSettings,
			fetchHealth,
			fetchSettings,
			fetchSources,
			fetchItems,
			fetchOnboardingRecommendations,
			createOnboardingRecommendation,
			updateOnboardingRecommendation,
			deleteOnboardingRecommendation,
			createSource,
			updateSource,
			updateSourceVisibility,
			fetchSourceImpact,
			fetchSourceDiagnostics,
			deleteSource,
			importGlobalOPML,
			retryGlobalOPMLSource,
			exportGlobalOPML,
			syncSource,
			updateSourceEnabled,
			retryItem,
			crawlNow,
			updateSettings,
		};
	},
);
