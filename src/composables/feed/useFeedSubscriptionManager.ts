import { apiRequestResult } from "@/api/client";
import { useApi } from "@/composables/useApi";
import { ref, watch, type Ref } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useFeedStore, type FeedOPMLImportResult } from "@/stores/feed";
import { reportError } from "@/utils/logger";
import {
	useOnboardingStore,
	type OnboardingFeedRecommendation,
} from "@/stores/onboarding";
import type {
	AutoAddSubscriptionPayload,
	FeedSourceDiagnostic,
	FeedSubscriptionRuleMatchType,
	Subscription,
} from "@/types";

type SubscriptionRuleSavePayload = {
	id: string | null;
	payload: {
		name: string;
		enabled: boolean;
		match_type: FeedSubscriptionRuleMatchType;
		conditions_json: Record<string, unknown>;
		action_group_id?: string | null;
		action_muted?: boolean | null;
		action_auto_mark_read?: boolean | null;
		action_auto_add_reading_list?: boolean | null;
	};
};

interface FeedSubscriptionManagerOptions {
	currentPage: Ref<number>;
	refreshTimeline: () => Promise<void>;
}

export function useFeedSubscriptionManager({
	currentPage,
	refreshTimeline,
}: FeedSubscriptionManagerOptions) {
	const feedStore = useFeedStore();
	const onboardingStore = useOnboardingStore();
	const authStore = useAuthStore();
	const api = useApi();

	const addingSubscription = ref(false);
	const showAddModal = ref(false);
	const showManageSheet = ref(false);
	const manageBusy = ref(false);
	const manageError = ref("");
	const manageMessage = ref("");
	const opmlImportResult = ref<FeedOPMLImportResult | null>(null);
	const addSubscriptionError = ref("");
	const addSubscriptionResetKey = ref(0);
	const onboardingBusy = ref(false);
	const onboardingActionError = ref("");
	const onboardingFailedIds = ref<string[]>([]);
	const onboardingMessage = ref("");
	const subscriptionDiagnostics = ref<Record<string, FeedSourceDiagnostic[]>>(
		{},
	);
	const loadingSubscriptionDiagnosticIds = ref<Set<string>>(new Set());
	let diagnosticsSessionGeneration = 0;

	watch(showManageSheet, (visible) => {
		if (!visible) {
			diagnosticsSessionGeneration += 1;
			subscriptionDiagnostics.value = {};
			loadingSubscriptionDiagnosticIds.value = new Set();
			return;
		}
		if (!authStore.isAuthenticated) return;
		void Promise.all([
			feedStore.fetchSubscriptions(),
			feedStore.fetchFilterPreferences(),
			feedStore.fetchGroups(),
			feedStore.fetchSubscriptionHubTree(),
			feedStore.fetchSubscriptionRules(),
		]);
	});

	const closeAddModal = () => {
		showAddModal.value = false;
		addSubscriptionError.value = "";
	};

	const toggleAddModal = () => {
		if (showAddModal.value) {
			closeAddModal();
			return;
		}
		showManageSheet.value = false;
		addSubscriptionError.value = "";
		showAddModal.value = true;
	};

	const openManageSheet = () => {
		showAddModal.value = false;
		addSubscriptionError.value = "";
		manageError.value = "";
		manageMessage.value = "";
		showManageSheet.value = true;
	};

	const autoAddSubscription = async (payload: AutoAddSubscriptionPayload) => {
		addSubscriptionError.value = "";
		addingSubscription.value = true;
		try {
			const success = await feedStore.autoAddSubscription(payload);
			if (success) {
				addSubscriptionResetKey.value += 1;
				showAddModal.value = false;
				await Promise.all([refreshSubscriptionState(), refreshTimeline()]);
				await onboardingStore.handleSubscriptionSuccess();
			} else {
				addSubscriptionError.value =
					feedStore.error || "添加失败，请检查地址是否正确";
			}
		} catch (error) {
			addSubscriptionError.value =
				error instanceof Error ? error.message : "添加失败";
		} finally {
			addingSubscription.value = false;
		}
	};

	const subscribeOnboardingRecommendations = async (
		recommendations: OnboardingFeedRecommendation[],
	) => {
		if (!recommendations.length || onboardingBusy.value) return;
		onboardingBusy.value = true;
		onboardingActionError.value = "";
		onboardingFailedIds.value = [];
		onboardingMessage.value = "";
		try {
			const results = await Promise.all(
				recommendations.map((recommendation) =>
					feedStore.subscribeToRSS(recommendation.rss_url, recommendation.title),
				),
			);
			const successCount = results.filter(Boolean).length;
			const failedCount = results.length - successCount;
			if (!successCount) {
				onboardingFailedIds.value = recommendations.map(
					(recommendation) => recommendation.id,
				);
				onboardingActionError.value = "订阅未成功，请重试。";
				return;
			}

			await onboardingStore.complete();
			await Promise.all([refreshSubscriptionState(), refreshTimeline()]);
			onboardingMessage.value = failedCount
				? `已订阅 ${successCount} 个来源，${failedCount} 个未成功`
				: `已订阅 ${successCount} 个来源`;
		} finally {
			onboardingBusy.value = false;
		}
	};

	const skipOnboarding = async () => {
		onboardingBusy.value = true;
		onboardingActionError.value = "";
		try {
			await onboardingStore.skip();
		} finally {
			onboardingBusy.value = false;
		}
	};

	const withManageBusy = async <T>(task: () => Promise<T>): Promise<T> => {
		manageBusy.value = true;
		try {
			return await task();
		} finally {
			manageBusy.value = false;
		}
	};

	const setManageError = (fallback: string) => {
		manageError.value = feedStore.error || fallback;
	};

	const refreshSubscriptionState = () =>
		Promise.all([
			feedStore.fetchSubscriptions(),
			feedStore.fetchGroups(),
			feedStore.fetchSubscriptionHubTree(),
		]);

	const createSubscriptionGroup = async (name: string) => {
		await withManageBusy(async () => {
			manageError.value = "";
			const success = await feedStore.createGroup(name);
			if (!success) {
				setManageError("创建失败");
				return;
			}
			await Promise.all([refreshSubscriptionState(), refreshTimeline()]);
		});
	};

	const renameSubscription = async (id: string, title: string) => {
		await withManageBusy(async () => {
			manageError.value = "";
			const success = await feedStore.updateSubscription(id, { title });
			if (!success) {
				setManageError("保存失败");
				return;
			}
			await Promise.all([refreshSubscriptionState(), refreshTimeline()]);
		});
	};

	const moveSubscription = async (id: string, groupId: string) => {
		await withManageBusy(async () => {
			manageError.value = "";
			const success = await feedStore.setSubscriptionGroup(id, groupId || null);
			if (!success) {
				setManageError("移动失败");
				return;
			}
			await Promise.all([refreshSubscriptionState(), refreshTimeline()]);
		});
	};

	const updateSubscriptionFlags = async (
		id: string,
		payload: {
			is_muted?: boolean;
			priority?: Subscription["priority"];
			auto_mark_read?: boolean;
			auto_add_reading_list?: boolean;
		},
	) => {
		await withManageBusy(async () => {
			manageError.value = "";
			const success = await feedStore.updateSubscription(id, payload);
			if (!success) {
				setManageError("保存失败");
				return;
			}
			await Promise.all([refreshSubscriptionState(), refreshTimeline()]);
		});
	};

	const deleteSubscription = async (feedSourceId: string) => {
		await withManageBusy(async () => {
			manageError.value = "";
			const success = await feedStore.unsubscribeSubscriptionHubSource(feedSourceId);
			if (!success) {
				setManageError("删除失败");
				return;
			}
			currentPage.value = 1;
			await Promise.all([refreshSubscriptionState(), refreshTimeline()]);
		});
	};

	const renameGroup = async (id: string, name: string) => {
		await withManageBusy(async () => {
			manageError.value = "";
			const success = await feedStore.updateGroup(id, name);
			if (!success) {
				setManageError("保存失败");
				return;
			}
			await refreshSubscriptionState();
		});
	};

	const deleteGroup = async (id: string) => {
		await withManageBusy(async () => {
			manageError.value = "";
			const success = await feedStore.deleteGroup(id);
			if (!success) {
				setManageError("删除失败");
				return;
			}
			currentPage.value = 1;
			await Promise.all([refreshSubscriptionState(), refreshTimeline()]);
		});
	};

	const loadSubscriptionDiagnostics = async (subscriptionID: string) => {
		if (
			!authStore.isAuthenticated ||
			loadingSubscriptionDiagnosticIds.value.has(subscriptionID)
		)
			return;
		const sessionGeneration = diagnosticsSessionGeneration;
		const token = authStore.token;
		loadingSubscriptionDiagnosticIds.value = new Set(
			loadingSubscriptionDiagnosticIds.value,
		).add(subscriptionID);
		try {
			const response = await apiRequestResult(
				`${api.url}/feed/subscriptions/${subscriptionID}/diagnostics`,
				{
					headers: { Authorization: `Bearer ${token}` },
				},
			);
			if (
				sessionGeneration !== diagnosticsSessionGeneration ||
				token !== authStore.token
			)
				return;
			if (!response.ok) {
				manageError.value = "无法加载近期抓取记录";
				return;
			}
			const payload = response.data as { data?: FeedSourceDiagnostic[] };
			subscriptionDiagnostics.value = {
				...subscriptionDiagnostics.value,
				[subscriptionID]: payload.data || [],
			};
		} catch (error) {
			reportError(error);
			if (
				sessionGeneration === diagnosticsSessionGeneration &&
				token === authStore.token
			) {
				manageError.value = "无法加载近期抓取记录";
			}
		} finally {
			if (
				sessionGeneration === diagnosticsSessionGeneration &&
				token === authStore.token
			) {
				const next = new Set(loadingSubscriptionDiagnosticIds.value);
				next.delete(subscriptionID);
				loadingSubscriptionDiagnosticIds.value = next;
			}
		}
	};

	const checkSubscriptionHealth = async (id: string) => {
		await withManageBusy(async () => {
			manageError.value = "";
			const success = await feedStore.checkSubscriptionHealth(id);
			if (!success) setManageError("检查失败");
		});
	};

	const checkAllSubscriptionsHealth = async () => {
		await withManageBusy(async () => {
			manageError.value = "";
			const success = await feedStore.checkAllSubscriptionsHealth();
			if (!success) setManageError("检查失败");
		});
	};

	const syncSubscription = async (id: string) => {
		manageError.value = "";
		const result = await feedStore.syncSubscription(id);
		if (!result) {
			setManageError("刷新失败");
			return;
		}
		if (!result.success) setManageError(result.error || "刷新失败");
		if (result.success || result.new_items > 0) {
			currentPage.value = 1;
			await Promise.all([refreshSubscriptionState(), refreshTimeline()]);
		}
	};

	const syncAllSubscriptions = async () => {
		manageError.value = "";
		const result = await feedStore.syncAllSubscriptions();
		if (!result) {
			setManageError("刷新失败");
			return;
		}
		if (result.failed > 0) setManageError(`${result.failed} 个来源刷新失败`);
		currentPage.value = 1;
		await Promise.all([refreshSubscriptionState(), refreshTimeline()]);
	};

	const setSubscriptionPaused = async (id: string, paused: boolean) => {
		await withManageBusy(async () => {
			manageError.value = "";
			const success = await feedStore.setSubscriptionPaused(id, paused);
			if (!success) {
				setManageError(paused ? "暂停失败" : "恢复失败");
				return;
			}
			manageMessage.value = paused ? "订阅已暂停" : "订阅已恢复";
			await Promise.all([refreshSubscriptionState(), refreshTimeline()]);
		});
	};

	const reorderSubscriptionGroups = async (ids: string[]) => {
		await withManageBusy(async () => {
			manageError.value = "";
			if (!(await feedStore.reorderSubscriptionGroups(ids))) {
				setManageError("分组排序失败");
				return;
			}
			await refreshSubscriptionState();
		});
	};

	const reorderSubscriptions = async (groupId: string, ids: string[]) => {
		await withManageBusy(async () => {
			manageError.value = "";
			if (!(await feedStore.reorderSubscriptions(groupId, ids))) {
				setManageError("订阅源排序失败");
				return;
			}
			await refreshSubscriptionState();
		});
	};

	const importOPML = async (file: File) => {
		await withManageBusy(async () => {
			manageError.value = "";
			manageMessage.value = "";
			const result = await feedStore.importOPML(file);
			opmlImportResult.value = result;
			if (result) {
				manageMessage.value = `新增 ${result.imported}，复用 ${result.reused}，失败 ${result.failed}`;
				currentPage.value = 1;
				await Promise.all([refreshSubscriptionState(), refreshTimeline()]);
			} else {
				manageError.value = feedStore.error || "导入失败";
			}
		});
	};

	const escapeXMLAttribute = (value: string) =>
		value
			.replace(/&/g, "&amp;")
			.replace(/"/g, "&quot;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");

	const retryOPMLFailure = async (failure: {
		url: string;
		title?: string;
		group?: string;
	}) => {
		const title = failure.title?.trim() || failure.url;
		const leaf = `<outline type="rss" text="${escapeXMLAttribute(title)}" xmlUrl="${escapeXMLAttribute(failure.url)}" />`;
		const body = failure.group?.trim()
			? `<outline text="${escapeXMLAttribute(failure.group)}">${leaf}</outline>`
			: leaf;
		const file = new File(
			[
				`<?xml version="1.0" encoding="UTF-8"?><opml version="2.0"><body>${body}</body></opml>`,
			],
			"retry-subscription.opml",
			{ type: "text/xml" },
		);
		await importOPML(file);
	};

	const batchUpdateSubscriptions = async (
		ids: string[],
		payload: {
			group_id?: string;
			is_muted?: boolean;
			auto_mark_read?: boolean;
			auto_add_reading_list?: boolean;
		},
	) => {
		await withManageBusy(async () => {
			manageError.value = "";
			manageMessage.value = "";
			const success = await feedStore.batchUpdateSubscriptions(ids, payload);
			if (!success) {
				setManageError("批量更新失败");
				return;
			}
			manageMessage.value = `已更新 ${ids.length} 个订阅源`;
			await Promise.all([refreshSubscriptionState(), refreshTimeline()]);
		});
	};

	const batchDeleteSubscriptions = async (ids: string[]) => {
		await withManageBusy(async () => {
			manageError.value = "";
			manageMessage.value = "";
			const results = await Promise.all(ids.map((id) =>
				feedStore.unsubscribeSubscriptionHubSource(id),
			));
			if (!results.every(Boolean)) {
				setManageError("批量取消订阅失败");
				await refreshSubscriptionState();
				return;
			}
			manageMessage.value = `已取消 ${ids.length} 个订阅源`;
			currentPage.value = 1;
			await Promise.all([refreshSubscriptionState(), refreshTimeline()]);
		});
	};

	const markSubscriptionReadState = async (id: string, read: boolean) => {
		await withManageBusy(async () => {
			manageError.value = "";
			const success = read
				? await feedStore.markSubscriptionRead(id)
				: await feedStore.markSubscriptionUnread(id);
			if (!success) {
				setManageError(read ? "标记已读失败" : "标记未读失败");
				return;
			}
			await Promise.all([refreshSubscriptionState(), refreshTimeline()]);
		});
	};

	const exportOPML = async () => {
		await withManageBusy(async () => {
			manageError.value = "";
			try {
				const blob = await feedStore.exportOPML();
				const url = URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.href = url;
				link.download = "atoman-subscriptions.opml";
				document.body.appendChild(link);
				link.click();
				link.remove();
				URL.revokeObjectURL(url);
			} catch (error) {
				manageError.value = error instanceof Error ? error.message : "导出失败";
			}
		});
	};

	const findSavedRuleId = (saved: SubscriptionRuleSavePayload) => {
		if (saved.id) return saved.id;
		const matchedRules = feedStore.subscriptionRules.filter(
			(rule) =>
				rule.name === saved.payload.name &&
				rule.match_type === saved.payload.match_type &&
				JSON.stringify(rule.conditions_json) ===
					JSON.stringify(saved.payload.conditions_json),
		);
		return matchedRules[matchedRules.length - 1]?.id || null;
	};

	const confirmApplySavedRule = async (ruleId: string | null) => {
		if (!ruleId || !window.confirm("规则已保存，是否立即应用到已有订阅？"))
			return;
		await feedStore.applySubscriptionRules({ rule_id: ruleId });
	};

	const saveSubscriptionRule = async (saved: SubscriptionRuleSavePayload) => {
		await withManageBusy(async () => {
			manageError.value = "";
			const success = saved.id
				? await feedStore.updateSubscriptionRule(saved.id, saved.payload)
				: await feedStore.createSubscriptionRule(saved.payload);
			if (!success) {
				manageError.value = feedStore.error || "保存失败";
				return;
			}
			await confirmApplySavedRule(findSavedRuleId(saved));
			await Promise.all([refreshSubscriptionState(), refreshTimeline()]);
		});
	};

	const reorderSubscriptionRules = async (nextRuleIds: string[]) => {
		await withManageBusy(async () => {
			manageError.value = "";
			const success = await feedStore.reorderSubscriptionRules(nextRuleIds);
			if (!success) setManageError("排序失败");
		});
	};

	const moveSubscriptionRuleUp = async (id: string) => {
		const index = feedStore.subscriptionRules.findIndex((rule) => rule.id === id);
		if (index <= 0) return;
		const next = [...feedStore.subscriptionRules];
		const [target] = next.splice(index, 1);
		next.splice(index - 1, 0, target);
		await reorderSubscriptionRules(next.map((rule) => rule.id));
	};

	const moveSubscriptionRuleDown = async (id: string) => {
		const index = feedStore.subscriptionRules.findIndex((rule) => rule.id === id);
		if (index < 0 || index >= feedStore.subscriptionRules.length - 1) return;
		const next = [...feedStore.subscriptionRules];
		const [target] = next.splice(index, 1);
		next.splice(index + 1, 0, target);
		await reorderSubscriptionRules(next.map((rule) => rule.id));
	};

	const applySubscriptionRule = async (id: string) => {
		await withManageBusy(async () => {
			manageError.value = "";
			const success = await feedStore.applySubscriptionRules({ rule_id: id });
			if (!success) {
				setManageError("应用失败");
				return;
			}
			await Promise.all([refreshSubscriptionState(), refreshTimeline()]);
		});
	};

	const applyAllSubscriptionRules = async () => {
		await withManageBusy(async () => {
			manageError.value = "";
			const success = await feedStore.applySubscriptionRules({ all: true });
			if (!success) {
				setManageError("应用失败");
				return;
			}
			await refreshTimeline();
		});
	};

	const deleteSubscriptionRule = async (id: string) => {
		await withManageBusy(async () => {
			manageError.value = "";
			const success = await feedStore.deleteSubscriptionRule(id);
			if (!success) setManageError("删除失败");
		});
	};

	const updateFilterRules = (rules: {
		mutedSourceIds: string[];
		hiddenKeywords: string[];
	}) => {
		feedStore.setFilterRules(rules);
	};

	const updateAutomationRules = (rules: {
		autoMarkReadSourceIds: string[];
		autoAddReadingListSourceIds: string[];
	}) => {
		feedStore.setAutomationRules(rules);
	};

	return {
		addingSubscription,
		showAddModal,
		showManageSheet,
		manageBusy,
		manageError,
		manageMessage,
		opmlImportResult,
		addSubscriptionError,
		addSubscriptionResetKey,
		onboardingBusy,
		onboardingActionError,
		onboardingFailedIds,
		onboardingMessage,
		subscriptionDiagnostics,
		loadingSubscriptionDiagnosticIds,
		closeAddModal,
		toggleAddModal,
		openManageSheet,
		autoAddSubscription,
		subscribeOnboardingRecommendations,
		skipOnboarding,
		createSubscriptionGroup,
		renameSubscription,
		moveSubscription,
		updateSubscriptionFlags,
		deleteSubscription,
		renameGroup,
		deleteGroup,
		loadSubscriptionDiagnostics,
		checkSubscriptionHealth,
		checkAllSubscriptionsHealth,
		syncSubscription,
		syncAllSubscriptions,
		importOPML,
		retryOPMLFailure,
		exportOPML,
		batchUpdateSubscriptions,
		batchDeleteSubscriptions,
		markSubscriptionReadState,
		setSubscriptionPaused,
		reorderSubscriptionGroups,
		reorderSubscriptions,
		saveSubscriptionRule,
		moveSubscriptionRuleUp,
		moveSubscriptionRuleDown,
		applySubscriptionRule,
		applyAllSubscriptionRules,
		deleteSubscriptionRule,
		updateFilterRules,
		updateAutomationRules,
	};
}
