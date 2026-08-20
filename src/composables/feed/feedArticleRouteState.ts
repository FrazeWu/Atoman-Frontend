import type { HistoryState } from "vue-router";
import type { FeedArticleSource, TimelineItem } from "@/types";

const STATE_KEY = "feedArticleBrowser";

export interface FeedArticleRouteState {
	article: TimelineItem;
	articles: TimelineItem[];
	source: FeedArticleSource | null;
	sourceArticles: TimelineItem[];
}

export function feedArticleRouteState(
	state: FeedArticleRouteState,
): HistoryState {
	return { [STATE_KEY]: state as unknown as HistoryState };
}

export function readFeedArticleRouteState(): FeedArticleRouteState | null {
	const state = window.history.state?.[STATE_KEY] as
		| Partial<FeedArticleRouteState>
		| undefined;
	if (!state?.article || !Array.isArray(state.articles)) return null;
	return {
		article: state.article,
		articles: state.articles,
		source: state.source ?? null,
		sourceArticles: state.sourceArticles ?? [],
	};
}
