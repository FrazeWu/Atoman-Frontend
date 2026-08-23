import { useRouter } from "vue-router";
import { createSheetStack } from "@/composables/useSheetStack";
import { isStandaloneMobileApp } from "@/utils/appRuntime";
import type { BlogSheetLayer } from "@/components/blog/blogSheetTypes";

const stack = createSheetStack<BlogSheetLayer>({
	maxLayers: 2,
	resolveOverflow: (next, current) => {
		const collection = current.find((layer) => layer.kind === "collection");
		return collection ? [collection, next] : [next];
	},
});

export function useBlogSheets() {
	const mobile = isStandaloneMobileApp();
	const router = mobile ? useRouter() : null;
	const openChannel = (channelId: string, title: string) => {
		if (mobile) {
			void router?.push(`/channel/${encodeURIComponent(channelId)}`);
			return;
		}
		stack.push({
			key: `channel:${channelId}`,
			kind: "channel",
			title,
			payload: { channelId },
		});
	};
	const openCollection = (
		collectionId: string,
		title: string,
		channelId: string,
	) => {
		if (mobile) {
			void router?.push(`/collection/${encodeURIComponent(collectionId)}`);
			return;
		}
		stack.push({
			key: `collection:${collectionId}`,
			kind: "collection",
			title,
			payload: { collectionId, channelId },
		});
	};

	const openPost = (postId: string, title: string, collectionId?: string) => {
		if (mobile) {
			void router?.push(`/posts/post/${encodeURIComponent(postId)}`);
			return;
		}
		stack.push({
			key: `post:${postId}`,
			kind: "post",
			title,
			route: `/posts/post/${postId}`,
			payload: { postId, collectionId },
		});
	};

	const openShortNote = (noteId: string, title?: string) => {
		if (mobile) {
			void router?.push(`/posts/notes/${encodeURIComponent(noteId)}`);
			return;
		}
		stack.push({
			key: `short_note:${noteId}`,
			kind: "short_note",
			title: title || "短笺",
			route: `/posts/notes/${noteId}`,
			payload: { noteId },
		});
	};

	const closeLayer = (key: string) => {
		stack.popTo(key);
		stack.pop();
	};

	const returnToLayer = (key: string) => stack.popTo(key);

	return {
		layers: stack.layers,
		renderLayers: stack.renderLayers,
		top: stack.top,
		openChannel,
		openCollection,
		openPost,
		openShortNote,
		closeLayer,
		returnToLayer,
		closeTop: stack.pop,
		closeAll: stack.clear,
		isTop: stack.isTop,
		isActive: stack.isActive,
		isShifted: stack.isShifted,
	};
}
