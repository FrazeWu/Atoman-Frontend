import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter, RouterLink } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";

// @ts-expect-error Vitest resolves Vue SFC imports through Vite, outside tsconfig's src-only include.
import PostDetailView from "../../../../src/views/blog/PostDetailView.vue";
import { useAuthStore } from "../../../../src/stores/auth";
import { useFeedStore } from "../../../../src/stores/feed";

const mocks = vi.hoisted(() => ({
	useInteractions: vi.fn(),
	setPageMeta: vi.fn(),
	restorePageMeta: vi.fn(),
	recordEvent: vi.fn(),
	saveProgress: vi.fn(),
	trackerOptions: [] as Array<{
		onEvent: (event: "open" | "engaged" | "complete") => void;
		onProgress: (progress: number) => void;
	}>,
	createContentConsumptionTracker: vi.fn(),
	interactions: {
		comments: { value: [] },
		likeCount: { value: 0 },
		commentCount: { value: 0 },
		liked: { value: false },
		loadingComments: { value: false },
		submittingComment: { value: false },
		like: vi.fn(),
		unlike: vi.fn(),
		fetchComments: vi.fn(),
		createComment: vi.fn(),
		deleteComment: vi.fn(),
	},
}));

vi.mock("@/composables/useInteractions", () => ({
	useInteractions: mocks.useInteractions,
}));

vi.mock("@/composables/usePageMeta", () => ({
	usePageMeta: () => ({
		setPageMeta: mocks.setPageMeta,
		restorePageMeta: mocks.restorePageMeta,
	}),
}));

vi.mock("@/composables/useContentLifecycle", () => ({
	useContentLifecycle: () => ({
		recordEvent: mocks.recordEvent,
		saveProgress: mocks.saveProgress,
	}),
	createContentConsumptionTracker: mocks.createContentConsumptionTracker,
}));

vi.mock("@/composables/useMarkdownRenderer", () => ({
	useMarkdownRenderer: () => ({ renderMarkdown: (content: string) => content }),
}));

const InteractionBarStub = defineComponent({
	name: "InteractionBar",
	props: ["liked", "likeCount", "commentCount", "disabled"],
	emits: ["like", "unlike"],
	setup(props) {
		return () =>
			h(
				"div",
				{ "data-test": "interaction-bar" },
				`喜欢 ${props.likeCount} 评论 ${props.commentCount}`,
			);
	},
});

const CommentSectionStub = defineComponent({
	name: "CommentSection",
	props: ["target", "noun", "readonly", "canDelete"],
	emits: ["count-change"],
	template: '<section data-test="unified-comment-section" />',
});

async function mountPostDetailWithRouter() {
	const pinia = createPinia();
	setActivePinia(pinia);

	const authStore = useAuthStore();
	authStore.isAuthenticated = true;
	authStore.token = "token-1";
	authStore.user = {
		uuid: "user-1",
		username: "author",
		email: "author@example.com",
	};

	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: "/", component: { template: "<div />" } },
			{ path: "/posts/post/:id", component: PostDetailView },
			{ path: "/studio/blog/:id/edit", component: { template: "<div />" } },
		],
	});
	await router.push("/posts/post/post-1");
	await router.isReady();

	const wrapper = mount(PostDetailView, {
		global: {
			plugins: [pinia, router],
			stubs: {
				RouterLink,
				InteractionBar: InteractionBarStub,
				CommentSection: CommentSectionStub,
			},
		},
	});
	await flushPromises();
	return { wrapper, router };
}

async function mountPostDetail() {
	return (await mountPostDetailWithRouter()).wrapper;
}

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	const promise = new Promise<T>((nextResolve) => {
		resolve = nextResolve;
	});
	return { promise, resolve };
}

const response = (data: unknown) =>
	new Response(JSON.stringify(data), { status: 200 });

const postDetail = (
	id: string,
	title: string,
	overrides: Record<string, unknown> = {},
) => ({
	id,
	user_id: "user-1",
	user: { uuid: "user-1", username: "author", email: "author@example.com" },
	title,
	content: `${title}正文`,
	status: "published",
	visibility: "public",
	pinned: false,
	liked: false,
	likes_count: 0,
	comments_count: 0,
	created_at: "2026-07-07T00:00:00Z",
	updated_at: "2026-07-07T00:00:00Z",
	...overrides,
});

describe("PostDetailView shared interactions", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	beforeEach(() => {
		vi.restoreAllMocks();
		mocks.useInteractions.mockReturnValue(mocks.interactions);
		mocks.interactions.like.mockReset();
		mocks.interactions.unlike.mockReset();
		mocks.interactions.comments.value = [];
		mocks.interactions.likeCount = ref(0);
		mocks.interactions.commentCount.value = 0;
		mocks.interactions.liked = ref(false);
		mocks.interactions.like.mockImplementation(async () => {
			mocks.interactions.liked.value = true;
			mocks.interactions.likeCount.value += 1;
		});
		mocks.interactions.unlike.mockImplementation(async () => {
			mocks.interactions.liked.value = false;
			mocks.interactions.likeCount.value = Math.max(
				0,
				mocks.interactions.likeCount.value - 1,
			);
		});
		mocks.interactions.fetchComments.mockResolvedValue(undefined);
		mocks.interactions.createComment.mockResolvedValue(undefined);
		mocks.interactions.deleteComment.mockResolvedValue(undefined);
		mocks.setPageMeta.mockReset();
		mocks.restorePageMeta.mockReset();
		mocks.recordEvent.mockReset().mockResolvedValue(undefined);
		mocks.saveProgress.mockReset().mockResolvedValue(undefined);
		mocks.trackerOptions.length = 0;
		mocks.createContentConsumptionTracker
			.mockReset()
			.mockImplementation((options) => {
				mocks.trackerOptions.push(options);
				return {
					open: vi.fn(() => options.onEvent("open")),
					update: vi.fn(),
				};
			});

		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string) => {
				if (url.includes("/blog/posts/post-1")) {
					return {
						ok: true,
						json: async () => ({
							data: {
								id: "post-1",
								user_id: "user-1",
								user: {
									uuid: "user-1",
									username: "author",
									email: "author@example.com",
								},
								title: "文章",
								content: "正文",
								status: "published",
								visibility: "public",
								pinned: false,
								liked: true,
								likes_count: 7,
								comments_count: 3,
								created_at: "2026-07-07T00:00:00Z",
								updated_at: "2026-07-07T00:00:00Z",
							},
						}),
					};
				}
				if (url.includes("/blog/bookmarks")) {
					return { ok: true, json: async () => ({ data: [] }) };
				}
				return { ok: true, json: async () => ({ data: [] }) };
			}),
		);
	});

	it("渲染统一评论组件并传入博客评论目标", async () => {
		const wrapper = await mountPostDetail();

		expect(mocks.useInteractions).toHaveBeenCalledWith(
			"blog",
			"post",
			expect.any(Object),
		);
		expect(mocks.useInteractions.mock.calls[0][2].value).toBe("post-1");
		expect(mocks.interactions.liked.value).toBe(true);
		expect(mocks.interactions.likeCount.value).toBe(7);
		expect(mocks.interactions.fetchComments).not.toHaveBeenCalled();
		expect(wrapper.find('[data-test="interaction-bar"]').exists()).toBe(true);
		expect(wrapper.get('[role="note"]').text()).toContain("最近更新时间：");
		expect(wrapper.get('[role="note"]').text()).toMatch(
			/\d{4}年\d+月\d+日，距今已过去 \d+ 周，请注意信息有效性。/,
		);
		expect(wrapper.get('a[href="/studio/blog/post-1/edit"]').text()).toBe(
			"编辑",
		);
		expect(wrapper.find('[data-test="unified-comment-section"]').exists()).toBe(
			true,
		);
		expect(wrapper.findComponent(CommentSectionStub).props("target")).toEqual({
			kind: "blog_post",
			resourceId: "post-1",
		});
		expect(
			vi
				.mocked(fetch)
				.mock.calls.some(([url]) => String(url).includes("/site/access")),
		).toBe(false);
	});

	it("切到 B 后丢弃 A 的迟到主响应及其副作用", async () => {
		const postA = deferred<Response>();
		const postB = deferred<Response>();
		vi.stubGlobal(
			"fetch",
			vi.fn((input) => {
				const url = String(input);
				if (url.includes("/blog/posts/post-1")) return postA.promise;
				if (url.includes("/blog/posts/post-2")) return postB.promise;
				if (url.includes("/blog/bookmarks"))
					return Promise.resolve(response({ data: [] }));
				return Promise.resolve(response({ data: [] }));
			}),
		);

		const { wrapper, router } = await mountPostDetailWithRouter();
		await router.push("/posts/post/post-2?source=timeline");
		await flushPromises();

		postB.resolve(
			response({
				data: postDetail("post-2", "文章 B", {
					channel_id: "channel-b",
					liked: true,
					likes_count: 8,
				}),
			}),
		);
		await flushPromises();
		expect(wrapper.text()).toContain("文章 B");

		postA.resolve(
			response({
				data: postDetail("post-1", "文章 A", {
					channel_id: "channel-a",
					likes_count: 3,
				}),
			}),
		);
		await flushPromises();

		expect(wrapper.text()).toContain("文章 B");
		expect(wrapper.text()).not.toContain("文章 A");
		expect(mocks.interactions.likeCount.value).toBe(8);
		expect(mocks.setPageMeta).toHaveBeenCalledTimes(1);
		expect(mocks.setPageMeta).toHaveBeenCalledWith(
			expect.objectContaining({ title: "文章 B" }),
		);
		expect(mocks.recordEvent).toHaveBeenCalledTimes(1);
		expect(mocks.recordEvent).toHaveBeenCalledWith(
			expect.objectContaining({ content_id: "post-2", source: "timeline" }),
		);
		const readEvents = vi
			.mocked(fetch)
			.mock.calls.filter(([url]) => String(url).includes("/feed/events/read"));
		expect(readEvents).toHaveLength(1);
		expect(JSON.parse(String(readEvents[0][1]?.body))).toMatchObject({
			source_id: "channel-b",
		});
	});

	it("切换文章时立即清空 A 的文章、收藏和嵌入状态", async () => {
		const embedID = "11111111-1111-1111-1111-111111111111";
		const postB = deferred<Response>();
		vi.stubGlobal(
			"fetch",
			vi.fn((input) => {
				const url = String(input);
				if (url.includes("/blog/posts/post-1")) {
					return Promise.resolve(
						response({
							data: postDetail("post-1", "文章 A", {
								content: `:::post{id="${embedID}"}\n:::`,
							}),
						}),
					);
				}
				if (url.includes(`/blog/posts/${embedID}`)) {
					return Promise.resolve(
						response({ data: postDetail(embedID, "嵌入文章") }),
					);
				}
				if (url.includes("/blog/posts/post-2")) return postB.promise;
				if (url.includes("/blog/bookmarks"))
					return Promise.resolve(response({ data: [{ post_id: "post-1" }] }));
				return Promise.resolve(response({ data: [] }));
			}),
		);

		const { wrapper, router } = await mountPostDetailWithRouter();
		expect(wrapper.vm.$.setupState.post.title).toBe("文章 A");
		expect(wrapper.vm.$.setupState.bookmarked).toBe(true);
		expect(Object.keys(wrapper.vm.$.setupState.postEmbeds)).toEqual([embedID]);
		const academicButton = wrapper
			.findAll("button")
			.find((button) => button.text().includes("学术双栏"));
		await academicButton!.trigger("click");
		expect(wrapper.vm.$.setupState.isAcademic).toBe(true);

		await router.push("/posts/post/post-2");
		await flushPromises();

		expect(wrapper.vm.$.setupState.loading).toBe(true);
		expect(wrapper.vm.$.setupState.post).toBeNull();
		expect(wrapper.vm.$.setupState.errorStatus).toBeNull();
		expect(wrapper.vm.$.setupState.isAcademic).toBe(false);
		expect(wrapper.vm.$.setupState.bookmarked).toBe(false);
		expect(wrapper.vm.$.setupState.postEmbeds).toEqual({});
		expect(wrapper.vm.$.setupState.musicEmbeds).toEqual({});
		expect(wrapper.vm.$.setupState.videoEmbeds).toEqual({});
	});

	it("切到 B 后丢弃 A 的迟到收藏操作结果", async () => {
		const bookmarkToggle = deferred<boolean | null>();
		vi.stubGlobal(
			"fetch",
			vi.fn((input) => {
				const url = String(input);
				if (url.includes("/blog/posts/post-1"))
					return Promise.resolve(
						response({ data: postDetail("post-1", "文章 A") }),
					);
				if (url.includes("/blog/posts/post-2"))
					return Promise.resolve(
						response({ data: postDetail("post-2", "文章 B") }),
					);
				if (url.includes("/blog/bookmarks"))
					return Promise.resolve(response({ data: [] }));
				return Promise.resolve(response({ data: [] }));
			}),
		);

		const { wrapper, router } = await mountPostDetailWithRouter();
		const feedStore = useFeedStore();
		const togglePostBookmark = vi
			.spyOn(feedStore, "togglePostBookmark")
			.mockReturnValue(bookmarkToggle.promise);
		const bookmarkButton = wrapper
			.findAll("button")
			.find((button) => button.text() === "收藏");

		const pendingToggle = bookmarkButton!.trigger("click");
		await router.push("/posts/post/post-2");
		await flushPromises();
		bookmarkToggle.resolve(true);
		await pendingToggle;
		await flushPromises();

		expect(togglePostBookmark).toHaveBeenCalledWith("post-1");
		expect(wrapper.vm.$.setupState.post.id).toBe("post-2");
		expect(wrapper.vm.$.setupState.bookmarked).toBe(false);
	});

	it("文章从 A 切到 B 再切回 A 后丢弃首次 A 的迟到收藏操作结果", async () => {
		const bookmarkToggle = deferred<boolean | null>();
		vi.stubGlobal(
			"fetch",
			vi.fn((input) => {
				const url = String(input);
				if (url.includes("/blog/posts/post-1"))
					return Promise.resolve(
						response({ data: postDetail("post-1", "文章 A") }),
					);
				if (url.includes("/blog/posts/post-2"))
					return Promise.resolve(
						response({ data: postDetail("post-2", "文章 B") }),
					);
				if (url.includes("/blog/bookmarks"))
					return Promise.resolve(response({ data: [] }));
				return Promise.resolve(response({ data: [] }));
			}),
		);

		const { wrapper, router } = await mountPostDetailWithRouter();
		const feedStore = useFeedStore();
		vi.spyOn(feedStore, "togglePostBookmark").mockReturnValue(
			bookmarkToggle.promise,
		);
		const bookmarkButton = wrapper
			.findAll("button")
			.find((button) => button.text() === "收藏");

		const pendingToggle = bookmarkButton!.trigger("click");
		await router.push("/posts/post/post-2");
		await flushPromises();
		await router.push("/posts/post/post-1");
		await flushPromises();
		bookmarkToggle.resolve(true);
		await pendingToggle;
		await flushPromises();

		expect(wrapper.vm.$.setupState.post.id).toBe("post-1");
		expect(wrapper.vm.$.setupState.bookmarked).toBe(false);
	});

	it("同一文章连续收藏切换时保留最后一次操作的结果", async () => {
		const firstToggle = deferred<boolean | null>();
		const secondToggle = deferred<boolean | null>();
		const wrapper = await mountPostDetail();
		const feedStore = useFeedStore();
		vi.spyOn(feedStore, "togglePostBookmark")
			.mockReturnValueOnce(firstToggle.promise)
			.mockReturnValueOnce(secondToggle.promise);
		const bookmarkButton = wrapper
			.findAll("button")
			.find((button) => button.text() === "收藏");

		const firstAction = bookmarkButton!.trigger("click");
		const secondAction = bookmarkButton!.trigger("click");
		secondToggle.resolve(false);
		await secondAction;
		firstToggle.resolve(true);
		await firstAction;
		await flushPromises();

		expect(wrapper.vm.$.setupState.bookmarked).toBe(false);
	});

	it("初始收藏 GET 在用户收藏操作后迟到时保留用户操作结果", async () => {
		const initialBookmarkState = deferred<Response>();
		vi.stubGlobal(
			"fetch",
			vi.fn((input) => {
				const url = String(input);
				if (url.includes("/blog/posts/post-1"))
					return Promise.resolve(
						response({ data: postDetail("post-1", "文章 A") }),
					);
				if (url.includes("/blog/bookmarks"))
					return initialBookmarkState.promise;
				return Promise.resolve(response({ data: [] }));
			}),
		);

		const wrapper = await mountPostDetail();
		const feedStore = useFeedStore();
		vi.spyOn(feedStore, "togglePostBookmark").mockResolvedValue(true);
		const bookmarkButton = wrapper
			.findAll("button")
			.find((button) => button.text() === "收藏");

		await bookmarkButton!.trigger("click");
		expect(wrapper.vm.$.setupState.bookmarked).toBe(true);

		initialBookmarkState.resolve(response({ data: [] }));
		await flushPromises();

		expect(wrapper.vm.$.setupState.bookmarked).toBe(true);
	});

	it("A 的迟到嵌入和收藏请求不能污染已加载的 B", async () => {
		const embedID = "11111111-1111-1111-1111-111111111111";
		const embedA = deferred<Response>();
		const postB = deferred<Response>();
		const bookmarkA = deferred<Response>();
		let bookmarkRequests = 0;
		vi.stubGlobal(
			"fetch",
			vi.fn((input) => {
				const url = String(input);
				if (url.includes("/blog/posts/post-1")) {
					return Promise.resolve(
						response({
							data: postDetail("post-1", "文章 A", {
								content: `:::post{id="${embedID}"}\n:::`,
							}),
						}),
					);
				}
				if (url.includes(`/blog/posts/${embedID}`)) return embedA.promise;
				if (url.includes("/blog/posts/post-2")) return postB.promise;
				if (url.includes("/blog/bookmarks")) {
					bookmarkRequests += 1;
					if (bookmarkRequests === 1)
						return Promise.resolve(response({ data: [{ post_id: "post-2" }] }));
					return bookmarkA.promise;
				}
				return Promise.resolve(response({ data: [] }));
			}),
		);

		const { wrapper, router } = await mountPostDetailWithRouter();
		await router.push("/posts/post/post-2");
		await flushPromises();
		postB.resolve(response({ data: postDetail("post-2", "文章 B") }));
		await flushPromises();
		expect(wrapper.vm.$.setupState.bookmarked).toBe(true);

		embedA.resolve(response({ data: postDetail(embedID, "A 的嵌入文章") }));
		await flushPromises();
		if (bookmarkRequests > 1) {
			bookmarkA.resolve(response({ data: [] }));
			await flushPromises();
		}

		expect(wrapper.vm.$.setupState.post.title).toBe("文章 B");
		expect(wrapper.vm.$.setupState.postEmbeds).toEqual({});
		expect(wrapper.vm.$.setupState.bookmarked).toBe(true);
		expect(bookmarkRequests).toBe(1);
	});

	it("收到取消点赞事件后调用交互 composable 并更新点赞状态", async () => {
		const wrapper = await mountPostDetail();
		const interactionBar = wrapper.findComponent(InteractionBarStub);

		interactionBar.vm.$emit("unlike");
		await flushPromises();

		expect(mocks.interactions.unlike).toHaveBeenCalledTimes(1);
		expect(interactionBar.props("liked")).toBe(false);
		expect(interactionBar.props("likeCount")).toBe(6);
	});

	it("收到点赞事件后调用交互 composable 并更新点赞状态", async () => {
		const wrapper = await mountPostDetail();
		const interactionBar = wrapper.findComponent(InteractionBarStub);
		mocks.interactions.liked.value = false;
		mocks.interactions.likeCount.value = 6;
		await wrapper.vm.$nextTick();

		interactionBar.vm.$emit("like");
		await flushPromises();

		expect(mocks.interactions.like).toHaveBeenCalledTimes(1);
		expect(interactionBar.props("liked")).toBe(true);
		expect(interactionBar.props("likeCount")).toBe(7);
	});

	it("仅将文章作者或管理员的删除权限传给统一评论组件", async () => {
		const wrapper = await mountPostDetail();
		const commentSection = wrapper.findComponent(CommentSectionStub);

		const authStore = useAuthStore();
		authStore.user = {
			id: 42,
			uuid: "reader-1",
			username: "reader",
			email: "reader@example.com",
		};
		await wrapper.vm.$nextTick();
		expect(commentSection.props("canDelete")).toBe(false);

		authStore.user = {
			uuid: "user-1",
			username: "author",
			email: "author@example.com",
		};
		await wrapper.vm.$nextTick();
		expect(commentSection.props("canDelete")).toBe(true);

		authStore.user = {
			uuid: "mod-1",
			username: "mod",
			email: "mod@example.com",
			role: "moderator",
		};
		await wrapper.vm.$nextTick();
		expect(commentSection.props("canDelete")).toBe(false);

		authStore.user = {
			uuid: "admin-1",
			username: "admin",
			email: "admin@example.com",
			role: "admin",
		};
		await wrapper.vm.$nextTick();
		expect(commentSection.props("canDelete")).toBe(true);

		authStore.user = {
			uuid: "owner-1",
			username: "owner",
			email: "owner@example.com",
			role: "owner",
		};
		await wrapper.vm.$nextTick();
		expect(commentSection.props("canDelete")).toBe(true);
	});

	it("提供收藏、稍后阅读和分享动作", async () => {
		const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("navigator", {
			...navigator,
			clipboard: { writeText: clipboardWriteText },
		});

		const wrapper = await mountPostDetail();
		const feedStore = useFeedStore();
		const togglePostBookmark = vi
			.spyOn(feedStore, "togglePostBookmark")
			.mockResolvedValue(true);
		const toggleReadingListItem = vi
			.spyOn(feedStore, "toggleReadingListItem")
			.mockResolvedValue(true);

		const buttons = wrapper.findAll("button");
		const bookmarkButton = buttons.find((button) => button.text() === "收藏");
		const readingListButton = buttons.find(
			(button) => button.text() === "稍后阅读",
		);
		const shareButton = buttons.find((button) => button.text() === "分享");

		expect(bookmarkButton).toBeTruthy();
		expect(readingListButton).toBeTruthy();
		expect(shareButton).toBeTruthy();

		await bookmarkButton!.trigger("click");
		await readingListButton!.trigger("click");
		await shareButton!.trigger("click");

		expect(togglePostBookmark).toHaveBeenCalledWith("post-1");
		expect(toggleReadingListItem).toHaveBeenCalledWith("post-1");
		expect(clipboardWriteText).toHaveBeenCalledWith(
			`${window.location.origin}/posts/post/post-1`,
		);
	});
});
