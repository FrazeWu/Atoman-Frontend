import { nextTick, type ComputedRef, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { apiRequestResult } from "@/api/client";
import { useApi } from "@/composables/useApi";
import { useContentLifecycle } from "@/composables/useContentLifecycle";
import { referencePublishErrorMessage } from "@/composables/useReferenceAutocomplete";
import { useAuthStore } from "@/stores/auth";
import { useStudioStore } from "@/stores/studio";
import { reportError } from "@/utils/logger";
import {
	parseDraftTimestamp,
	type PostEditorContentSource,
	type PostEditorDraftForm,
	type SaveTarget,
} from "@/composables/blog/usePostEditorDraftSession";

interface PostEditorPublicationOptions {
	isEdit: ComputedRef<boolean>;
	form: Ref<PostEditorDraftForm>;
	contentSource: Ref<PostEditorContentSource>;
	contentReady: Ref<boolean>;
	loadedPostUpdatedAt: Ref<number>;
	saving: Ref<SaveTarget | null>;
	savedPostId: Ref<string | null>;
	markdownImportID: Ref<string | null>;
	scheduling: Ref<boolean>;
	scheduledAt: Ref<string>;
	error: Ref<string>;
	currentChannelId: ComputedRef<string>;
	primaryCollectionId: ComputedRef<string>;
	selectedNonDefaultCollectionId: ComputedRef<string>;
	selectedCollectionIds: Ref<string[]>;
	existingCollectionIds: Ref<string[]>;
	clearAllDrafts: () => Promise<void>;
	allowNextRouteLeave: () => void;
}

const toLocalDatetimeValue = (value: string) => {
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) return "";
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 16);
};

export function usePostEditorPublication({
	isEdit,
	form,
	contentSource,
	contentReady,
	loadedPostUpdatedAt,
	saving,
	savedPostId,
	markdownImportID,
	scheduling,
	scheduledAt,
	error,
	currentChannelId,
	primaryCollectionId,
	selectedNonDefaultCollectionId,
	selectedCollectionIds,
	existingCollectionIds,
	clearAllDrafts,
	allowNextRouteLeave,
}: PostEditorPublicationOptions) {
	const route = useRoute();
	const router = useRouter();
	const api = useApi();
	const authStore = useAuthStore();
	const studio = useStudioStore();
	const lifecycle = useContentLifecycle();

	const loadPost = async () => {
		if (!isEdit.value) return;
		try {
			const postId = String(route.params.id || "");
			if (!postId) return;
			const response = await apiRequestResult(api.blog.post(postId), {
				headers: authStore.token
					? { Authorization: `Bearer ${authStore.token}` }
					: {},
			});
			if (!response.ok) return;

			const data = response.data;
			const post = data.data || data;
			form.value = {
				title: post.title,
				content: post.content || "",
				summary: post.summary || "",
				cover_url: post.cover_url || "",
				visibility: post.visibility || "public",
			};
			scheduledAt.value = post.scheduled_at
				? toLocalDatetimeValue(post.scheduled_at)
				: "";
			loadedPostUpdatedAt.value = parseDraftTimestamp(post.updated_at);
			contentSource.value = "manual";
			const contentChannelId = post.channel_id;
			if (contentChannelId && studio.currentChannel?.id !== contentChannelId) {
				await studio.selectChannel(contentChannelId);
			}
			const collectionId = String(post.collection_id || "");
			existingCollectionIds.value = collectionId ? [collectionId] : [];
			selectedCollectionIds.value = [...existingCollectionIds.value];
		} catch (cause) {
			reportError(cause);
		} finally {
			contentReady.value = true;
			await nextTick();
		}
	};

	const save = async (
		status: SaveTarget,
		redirect = true,
	): Promise<string | null> => {
		if (saving.value) return null;
		if (savedPostId.value) {
			if (redirect) {
				allowNextRouteLeave();
				await router.push(`/posts/post/${savedPostId.value}`);
			}
			return savedPostId.value;
		}
		if (!form.value.title.trim()) {
			error.value = "请输入文章标题";
			return null;
		}
		if (!form.value.content.trim()) {
			error.value = "请输入文章内容";
			return null;
		}
		if (!currentChannelId.value) {
			error.value = "请先创建频道";
			return null;
		}
		if (status === "published" && selectedCollectionIds.value.length === 0) {
			error.value = "请先选择合集";
			return null;
		}

		error.value = "";
		saving.value = status;
		const payload = { ...form.value, status };
		try {
			const postId = String(route.params.id || "");
			const response = await apiRequestResult(
				isEdit.value ? api.blog.post(postId) : api.blog.posts,
				{
					method: isEdit.value ? "PUT" : "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${authStore.token}`,
					},
					body: JSON.stringify({
						...payload,
						channel_id: currentChannelId.value,
						collection_id: primaryCollectionId.value || undefined,
					}),
				},
			);
			if (!response.ok) {
				const responseError = response.data;
				error.value = referencePublishErrorMessage(
					responseError,
					typeof responseError.error === "string"
						? responseError.error
						: "保存失败，请重试",
				);
				return null;
			}

			const data = response.data;
			const savedPost = data.data || data;
			savedPostId.value = String(savedPost.id);
			if (!isEdit.value && markdownImportID.value) {
				const confirmResponse = await apiRequestResult(
					api.blog.markdownImportConfirm(markdownImportID.value),
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${authStore.token}`,
						},
						body: JSON.stringify({ content_id: savedPostId.value }),
					},
				);
				if (confirmResponse.ok) {
					markdownImportID.value = null;
				} else {
					error.value = "文章已保存，但导入记录确认失败";
				}
			}
			await clearAllDrafts();
			allowNextRouteLeave();
			if (!redirect) return savedPostId.value;
			if (status === "draft") {
				await router.push({
					path: "/studio/blog/content",
					query: selectedNonDefaultCollectionId.value
						? { collection_id: selectedNonDefaultCollectionId.value }
						: undefined,
				});
			} else {
				await router.push(`/posts/post/${savedPost.id}`);
			}
			return savedPostId.value;
		} catch (cause) {
			error.value = cause instanceof Error ? cause.message : "网络错误，请重试";
			return null;
		} finally {
			saving.value = null;
		}
	};

	const schedulePublish = async () => {
		if (!selectedCollectionIds.value.length) {
			error.value = "请先选择合集";
			return;
		}
		const publishAt = new Date(scheduledAt.value);
		if (
			!Number.isFinite(publishAt.getTime()) ||
			publishAt.getTime() <= Date.now()
		) {
			error.value = "请选择未来的发布时间";
			return;
		}

		scheduling.value = true;
		error.value = "";
		try {
			const postId = await save("draft", false);
			if (!postId) return;
			await lifecycle.schedule("blog", postId, publishAt.toISOString());
			allowNextRouteLeave();
			await router.push("/studio/blog/content");
		} catch (cause) {
			error.value = cause instanceof Error ? cause.message : "设置失败，请重试";
		} finally {
			scheduling.value = false;
		}
	};

	return { loadPost, save, schedulePublish };
}
