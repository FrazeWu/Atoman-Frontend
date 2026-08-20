import { computed, ref, type ComputedRef, type Ref } from "vue";
import { useRouter } from "vue-router";
import { apiRequestResult } from "@/api/client";
import { useApiUrl } from "@/composables/useApi";
import { feedArticleRouteState } from "@/composables/feed/feedArticleRouteState";
import { useAuthStore } from "@/stores/auth";
import { useFeedStore } from "@/stores/feed";
import type {
	FeedArticleSource,
	FeedItem,
	Subscription,
	TimelineItem,
} from "@/types";
import { buildFeedTimelineQuery } from "@/utils/feedTimelineQuery";
import { looksLikeUrl } from "@/utils/feedTitles";
import { reportError } from "@/utils/logger";

interface FeedArticleBrowserOptions {
	visibleTimeline: ComputedRef<TimelineItem[]>;
	subscriptions: ComputedRef<Subscription[]>;
	focusedIndex: Ref<number>;
	itemKey: (item: TimelineItem) => string;
	feedItemActionIDs: (item: FeedItem) => string[];
}

export function useFeedArticleBrowser({
	visibleTimeline,
	subscriptions,
	focusedIndex,
	itemKey,
	feedItemActionIDs,
}: FeedArticleBrowserOptions) {
	const authStore = useAuthStore();
	const feedStore = useFeedStore();
	const apiURL = useApiUrl();
	const router = useRouter();

	const showArticleSheet = ref(false);
	const selectedArticle = ref<TimelineItem | null>(null);
	const selectedArticleIndex = computed(() => {
		if (!selectedArticle.value) return -1;
		return visibleTimeline.value.findIndex(
			(item) => itemKey(item) === itemKey(selectedArticle.value!),
		);
	});
	const showSourceSheet = ref(false);
	const selectedSource = ref<FeedArticleSource | null>(null);
	const sourceArticles = ref<TimelineItem[]>([]);
	const sourceArticlesLoading = ref(false);
	const sourceSubscribeBusy = ref(false);

	const markReadOnOpen = (item: TimelineItem) => {
		if (
			!authStore.isAuthenticated ||
			item.type !== "feed_item" ||
			!item.feed_item ||
			item.is_read
		)
			return;
		item.is_read = true;
		void (async () => {
			const success = await feedStore.markItemsRead(
				feedItemActionIDs(item.feed_item!),
			);
			if (success) {
				await feedStore.fetchSubscriptions();
				return;
			}
			item.is_read = false;
		})();
	};

	const openArticleSheet = (item: TimelineItem, index?: number) => {
		if (index !== undefined) focusedIndex.value = index;
		if (!item.post && !item.feed_item) return;

		if (item.type === "feed_item" && item.feed_item) {
			void router.push({
				path: `/feed/item/${item.feed_item.id}`,
				state: feedArticleRouteState({
					article: item,
					articles: visibleTimeline.value,
					source: selectedSource.value,
					sourceArticles: sourceArticles.value,
				}),
			});
			markReadOnOpen(item);
			return;
		}

		selectedArticle.value = item;
		showArticleSheet.value = true;
		markReadOnOpen(item);
	};

	const openPreviousArticle = () => {
		if (selectedArticleIndex.value <= 0) return;
		const nextItem = visibleTimeline.value[selectedArticleIndex.value - 1];
		if (!nextItem) return;
		openArticleSheet(nextItem, selectedArticleIndex.value - 1);
	};

	const openNextArticle = () => {
		if (
			selectedArticleIndex.value < 0 ||
			selectedArticleIndex.value >= visibleTimeline.value.length - 1
		)
			return;
		const nextItem = visibleTimeline.value[selectedArticleIndex.value + 1];
		if (!nextItem) return;
		openArticleSheet(nextItem, selectedArticleIndex.value + 1);
	};

	const openSourceArticle = (item: TimelineItem) => {
		selectedArticle.value = item;
		showArticleSheet.value = true;
		markReadOnOpen(item);
	};

	const findSubscriptionForSource = (source: FeedArticleSource) => {
		if (source.type === "internal_channel") {
			return subscriptions.value.find(
				(subscription) =>
					subscription.feed_source?.source_type === "internal_channel" &&
					subscription.feed_source.source_id === source.id,
			);
		}
		if (source.type === "external_rss") {
			return subscriptions.value.find(
				(subscription) =>
					subscription.feed_source_id === source.id ||
					subscription.feed_source?.id === source.id ||
					(!!source.rssUrl &&
						subscription.feed_source?.rss_url === source.rssUrl),
			);
		}
		return undefined;
	};

	const withSubscriptionState = (
		source: FeedArticleSource,
	): FeedArticleSource => {
		const subscription = findSubscriptionForSource(source);
		return {
			...source,
			subscriptionId: subscription?.id || source.subscriptionId,
			subscribed: Boolean(subscription || source.subscribed),
		};
	};

	const sourceDisplayTitle = (
		source: FeedArticleSource,
		subscriptionTitle?: string,
	) => {
		const customTitle = subscriptionTitle?.trim();
		if (customTitle && !looksLikeUrl(customTitle)) return customTitle;

		const normalizedTitle = source.title?.trim();
		if (normalizedTitle) return normalizedTitle;
		if (customTitle) return customTitle;

		if (source.type === "external_rss") {
			const rssURL = source.rssUrl?.trim();
			if (rssURL) return rssURL;
		}

		return source.type === "external_rss" ? "RSS" : "未命名频道";
	};

	const postSource = (item: TimelineItem): FeedArticleSource | null => {
		if (item.type !== "post" || !item.post) return null;
		const channelID = item.post.channel_id || item.post.channel?.id;
		if (!channelID) return null;
		const source: FeedArticleSource = {
			type: "internal_channel",
			id: channelID,
			title: item.post.channel?.name || "",
			subscribed: false,
		};
		const subscription = findSubscriptionForSource(source);
		return withSubscriptionState({
			...source,
			title: sourceDisplayTitle(source, subscription?.title),
		});
	};

	const feedItemSource = (item: FeedItem): FeedArticleSource | null => {
		const sourceID = item.feed_source?.id || item.feed_source_id;
		if (!sourceID) return null;
		const source: FeedArticleSource = {
			type: "external_rss",
			id: sourceID,
			title: item.feed_source?.title || "",
			rssUrl: item.feed_source?.rss_url,
			subscribed: false,
		};
		const subscription = findSubscriptionForSource(source);
		return withSubscriptionState({
			...source,
			title: sourceDisplayTitle(source, subscription?.title),
		});
	};

	const sourceTriggerLabel = (source: FeedArticleSource) =>
		`查看 ${source.title} 的所有文章`;

	const fetchSourceArticles = async (source: FeedArticleSource) => {
		if (!source.subscriptionId) {
			sourceArticles.value = [];
			return;
		}

		sourceArticlesLoading.value = true;
		try {
			const params = buildFeedTimelineQuery({
				limit: 100,
				sourceId: source.subscriptionId,
			});
			const headers: HeadersInit = authStore.isAuthenticated
				? { Authorization: `Bearer ${authStore.token}` }
				: {};
			const response = await apiRequestResult(
				`${apiURL}/feed/timeline?${params}`,
				{ headers },
			);
			if (response.ok) {
				sourceArticles.value = response.data.data || [];
			}
		} catch (error) {
			reportError(error);
			sourceArticles.value = [];
		} finally {
			sourceArticlesLoading.value = false;
		}
	};

	const openSourceSheet = async (source: FeedArticleSource) => {
		selectedSource.value = withSubscriptionState(source);
		sourceArticles.value = [];
		showSourceSheet.value = true;
		showArticleSheet.value = false;
		await fetchSourceArticles(selectedSource.value);
	};

	const openPostSourceSheet = async (item: TimelineItem) => {
		const source = postSource(item);
		if (source) await openSourceSheet(source);
	};

	const openFeedItemSourceSheet = async (item: FeedItem) => {
		const source = feedItemSource(item);
		if (source) await openSourceSheet(source);
	};

	const subscribeSelectedSource = async () => {
		if (
			!selectedSource.value ||
			selectedSource.value.subscribed ||
			!authStore.isAuthenticated
		)
			return;

		sourceSubscribeBusy.value = true;
		try {
			let success = false;
			if (selectedSource.value.type === "internal_channel") {
				success = await feedStore.subscribeToChannel(selectedSource.value.id);
			} else if (
				selectedSource.value.type === "external_rss" &&
				selectedSource.value.rssUrl
			) {
				success = await feedStore.subscribeToRSS(
					selectedSource.value.rssUrl,
					selectedSource.value.title,
				);
			}
			if (!success) return;

			await feedStore.fetchSubscriptions();
			selectedSource.value = withSubscriptionState(selectedSource.value);
			await fetchSourceArticles(selectedSource.value);
		} finally {
			sourceSubscribeBusy.value = false;
		}
	};

	return {
		showArticleSheet,
		selectedArticle,
		selectedArticleIndex,
		showSourceSheet,
		selectedSource,
		sourceArticles,
		sourceArticlesLoading,
		sourceSubscribeBusy,
		openArticleSheet,
		openPreviousArticle,
		openNextArticle,
		openSourceArticle,
		postSource,
		feedItemSource,
		sourceTriggerLabel,
		openPostSourceSheet,
		openFeedItemSourceSheet,
		subscribeSelectedSource,
	};
}
