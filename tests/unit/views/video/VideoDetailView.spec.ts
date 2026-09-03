import { describe, it, expect, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { createRouter, createMemoryHistory, RouterLink } from "vue-router";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent, h } from "vue";
import VideoDetailView from "@/views/video/VideoDetailView.vue";
import { useAuthStore } from "@/stores/auth";

const mocks = vi.hoisted(() => ({
	useInteractions: vi.fn(),
	interactions: {
		likeCount: { value: 0 },
		commentCount: { value: 0 },
		liked: { value: false },
		like: vi.fn(),
		unlike: vi.fn(),
	},
}));

vi.mock("@/composables/useInteractions", () => ({
	useInteractions: mocks.useInteractions,
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

const CommentSideSheetStub = defineComponent({
	name: "CommentSideSheet",
	props: [
		"show",
		"title",
		"target",
		"partialAnchor",
		"noun",
		"currentTime",
		"canDelete",
	],
	emits: ["seek", "count-change"],
	template: '<section v-if="show" data-test="video-comment-sheet" />',
});

const PVideoPlayerShellStub = defineComponent({
	name: "PVideoPlayerShell",
	template:
		'<section><slot name="player" /><slot name="timeline-preview" /><slot /></section>',
});

const VideoContinueListStub = defineComponent({
	name: "VideoContinueList",
	props: ["videos"],
	template: '<aside>{{ videos.map((video) => video.title).join(",") }}</aside>',
});

const VideoPlayerControlsStub = defineComponent({
	name: "VideoPlayerControls",
	template: '<div data-test="video-player-controls" />',
});

const VideoCollectionPlaylistStub = defineComponent({
	name: "VideoCollectionPlaylist",
	props: ["collection", "videos", "currentVideoId"],
	emits: ["select"],
	template:
		'<aside data-test="video-collection-playlist">{{ collection?.name }}<button type="button" @click="$emit(\'select\', videos[1]?.id)">next</button></aside>',
});

const VideoRecommendationRowStub = defineComponent({
	name: "VideoRecommendationRow",
	props: ["videos"],
	template:
		'<section data-test="video-recommendations">{{ videos.map((video) => video.title).join(",") }}</section>',
});

const PostRatingControlStub = defineComponent({
	name: "PostRatingControl",
	props: [
		"viewerRating",
		"weightedRatingScore",
		"weightedRatingCount",
		"weightedRatingActive",
	],
	emits: ["rate", "clear"],
	template: '<section data-test="video-rating-control" />',
});

const PBookmarkButtonStub = defineComponent({
	name: "PBookmarkButton",
	props: ["bookmarked", "disabled"],
	emits: ["bookmark", "unbookmark"],
	template: '<button type="button" data-test="video-bookmark" />',
});

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

const makeJsonResponse = (data: unknown) =>
	new Response(JSON.stringify(data), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});

const makeVideo = (
	id: string,
	title: string,
	extra: Record<string, unknown> = {},
) => ({
	id,
	title,
	user_id: "user-1",
	channel_id: "channel-1",
	description: "",
	video_url: `https://example.com/${id}.mp4`,
	storage_type: "external",
	thumbnail_url: "",
	duration_sec: 0,
	visibility: "public",
	status: "published",
	view_count: 0,
	tags: [],
	created_at: "2026-06-30T00:00:00Z",
	updated_at: "2026-06-30T00:00:00Z",
	...extra,
});

async function mountVideoDetail(
	path = "/videos/watch/video-1",
	authenticated = true,
) {
	const pinia = createPinia();
	setActivePinia(pinia);

	const authStore = useAuthStore();
	authStore.isAuthenticated = authenticated;
	authStore.token = authenticated ? "token-1" : null;
	authStore.user = authenticated
		? { uuid: "user-2", username: "reader", email: "reader@example.com" }
		: null;

	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: "/videos/watch/:id", component: VideoDetailView }],
	});
	await router.push(path);
	await router.isReady();

	const wrapper = mount(VideoDetailView, {
		global: {
			plugins: [pinia, router],
			stubs: {
				RouterLink,
				InteractionBar: InteractionBarStub,
				CommentSideSheet: CommentSideSheetStub,
				PVideoPlayerShell: PVideoPlayerShellStub,
				VideoContinueList: VideoContinueListStub,
				VideoCollectionPlaylist: VideoCollectionPlaylistStub,
				VideoRecommendationRow: VideoRecommendationRowStub,
				PostRatingControl: PostRatingControlStub,
				PBookmarkButton: PBookmarkButtonStub,
				PButton: true,
				VideoPlayerControls: VideoPlayerControlsStub,
			},
		},
	});
	await flushPromises();
	return { wrapper, router };
}

describe("VideoDetailView shared interactions", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		setActivePinia(createPinia());
		mocks.useInteractions.mockReturnValue(mocks.interactions);
		mocks.interactions.likeCount.value = 0;
		mocks.interactions.commentCount.value = 0;
		mocks.interactions.liked.value = false;
		window.localStorage.clear();
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (init?.method === "POST" && url.endsWith("/view"))
					return makeJsonResponse({});
				if (url.endsWith("/videos/video-1")) {
					return makeJsonResponse(
						makeVideo("video-1", "当前视频", {
							liked: true,
							like_count: 6,
						}),
					);
				}
				if (url.endsWith("/videos/video-1/recommended"))
					return makeJsonResponse([]);
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);
	});

	it("通过评论抽屉初始化统一评论目标和互动状态", async () => {
		const { wrapper } = await mountVideoDetail();

		expect(mocks.useInteractions).toHaveBeenCalledWith(
			"videos",
			"video",
			expect.any(Object),
		);
		expect(mocks.useInteractions.mock.calls[0][2].value).toBe("video-1");
		expect(mocks.interactions.liked.value).toBe(true);
		expect(mocks.interactions.likeCount.value).toBe(6);
		expect(mocks.interactions.commentCount.value).toBe(0);
		expect(wrapper.get('[data-testid="video-comments"]').exists()).toBe(true);
		await wrapper.get('[data-testid="video-comments"]').trigger("click");
		const comments = wrapper.findComponent(CommentSideSheetStub);
		expect(comments.props("target")).toEqual({
			kind: "video",
			resourceId: "video-1",
		});
		expect(comments.props("noun")).toBe("评论");
	});

	it("游客打开视频时不发送需要登录的消费事件", async () => {
		await mountVideoDetail("/videos/watch/video-1", false);

		const urls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
		expect(urls.some((url) => url.endsWith("/content/events"))).toBe(false);
		expect(urls.some((url) => url.endsWith("/videos/video-1/view"))).toBe(true);
	});

	it("仅视频作者或版主可删除任意视频评论", async () => {
		const { wrapper } = await mountVideoDetail();
		const authStore = useAuthStore();
		await wrapper.get('[data-testid="video-comments"]').trigger("click");
		const comments = wrapper.findComponent(CommentSideSheetStub);

		expect(comments.props("canDelete")).toBe(false);

		authStore.user = {
			uuid: "user-1",
			username: "author",
			email: "author@example.com",
		};
		await nextTick();
		expect(comments.props("canDelete")).toBe(true);

		for (const role of ["moderator", "admin", "owner"] as const) {
			authStore.user = {
				uuid: "user-2",
				username: role,
				email: `${role}@example.com`,
				role,
			};
			await nextTick();
			expect(comments.props("canDelete")).toBe(true);
		}
	});

	it("路由 video id 切换后更新统一评论区 target", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (init?.method === "POST" && url.endsWith("/view"))
					return makeJsonResponse({});
				if (url.endsWith("/videos/video-1"))
					return makeJsonResponse(makeVideo("video-1", "第一个视频"));
				if (url.endsWith("/videos/video-1/recommended"))
					return makeJsonResponse([]);
				if (url.endsWith("/videos/video-2"))
					return makeJsonResponse(makeVideo("video-2", "第二个视频"));
				if (url.endsWith("/videos/video-2/recommended"))
					return makeJsonResponse([]);
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);

		const { wrapper, router } = await mountVideoDetail();
		await router.push("/videos/watch/video-2");
		await flushPromises();
		await wrapper.get('[data-testid="video-comments"]').trigger("click");

		expect(wrapper.findComponent(CommentSideSheetStub).props("target")).toEqual({
			kind: "video",
			resourceId: "video-2",
		});
	});

	it("本地视频评论时间取整，并响应 seek 更新播放器时间", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (init?.method === "POST" && url.endsWith("/view"))
					return makeJsonResponse({});
				if (url.endsWith("/videos/video-1"))
					return makeJsonResponse(
						makeVideo("video-1", "本地视频", { storage_type: "local" }),
					);
				if (url.endsWith("/videos/video-1/recommended"))
					return makeJsonResponse([]);
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);
		const play = vi
			.spyOn(HTMLMediaElement.prototype, "play")
			.mockResolvedValue(undefined);

		const { wrapper } = await mountVideoDetail();
		expect(wrapper.get("video").attributes("controls")).toBeUndefined();
		expect(wrapper.find('[data-test="video-player-controls"]').exists()).toBe(
			true,
		);
		const video = wrapper.get("video").element as HTMLVideoElement;
		Object.defineProperty(video, "currentTime", {
			configurable: true,
			value: 12.8,
			writable: true,
		});
		await wrapper.get('[data-testid="video-comments"]').trigger("click");
		const comments = wrapper.findComponent(CommentSideSheetStub);
		const currentTime = comments.props("currentTime") as () => number | null;

		expect(currentTime()).toBe(12);
		comments.vm.$emit("seek", 84);
		await wrapper.vm.$nextTick();

		expect(video.currentTime).toBe(84);
		expect(currentTime()).toBe(84);
		expect(play).toHaveBeenCalled();
	});

	it("本地对象存储的视频与字幕通过开发代理加载", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (init?.method === "POST" && url.endsWith("/view")) return makeJsonResponse({});
				if (url.endsWith("/videos/video-1")) {
					return makeJsonResponse(makeVideo("video-1", "对象存储视频", {
						storage_type: "local",
						video_url: "http://localhost:9100/atoman-dev/video/imports/source.mp4",
						subtitle_url: "http://localhost:9100/atoman-dev/video/subtitles/source.vtt",
					}));
				}
				if (url.endsWith("/videos/video-1/recommended")) return makeJsonResponse([]);
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);

		const { wrapper } = await mountVideoDetail();

		expect(wrapper.get("video").attributes("src")).toBe("/__object-storage/atoman-dev/video/imports/source.mp4");
		expect(wrapper.get("track").attributes("src")).toBe("/__object-storage/atoman-dev/video/subtitles/source.vtt");
	});

	it("本地保存的中段进度要求用户选择继续或从头播放", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (init?.method === "POST" && url.endsWith("/view"))
					return makeJsonResponse({});
				if (url.endsWith("/videos/video-1"))
					return makeJsonResponse(
						makeVideo("video-1", "本地视频", {
							storage_type: "local",
							duration_sec: 120,
						}),
					);
				if (url.endsWith("/videos/video-1/recommended"))
					return makeJsonResponse([]);
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);
		window.localStorage.setItem(
			"atoman:video-progress:video-1",
			JSON.stringify({
				time_sec: 84,
				duration_sec: 120,
				updated_at: "2026-06-30T00:00:00Z",
			}),
		);
		const play = vi
			.spyOn(HTMLMediaElement.prototype, "play")
			.mockResolvedValue(undefined);

		const { wrapper } = await mountVideoDetail("/videos/watch/video-1", false);
		const video = wrapper.get("video");
		Object.defineProperty(video.element, "duration", {
			configurable: true,
			value: 120,
		});
		await video.trigger("loadedmetadata");
		await flushPromises();

		expect(wrapper.get('[data-testid="video-resume-prompt"]').text()).toContain(
			"1:24",
		);
		expect(wrapper.find('[data-testid="video-play"]').exists()).toBe(false);

		await wrapper.get('[data-testid="video-resume-continue"]').trigger("click");
		await flushPromises();

		expect((video.element as HTMLVideoElement).currentTime).toBe(84);
		expect(play).toHaveBeenCalled();
		expect(wrapper.find('[data-testid="video-resume-prompt"]').exists()).toBe(
			false,
		);
	});

	it("从头播放会清除本地进度并从零开始", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (init?.method === "POST" && url.endsWith("/view"))
					return makeJsonResponse({});
				if (url.endsWith("/videos/video-1"))
					return makeJsonResponse(
						makeVideo("video-1", "本地视频", {
							storage_type: "local",
							duration_sec: 120,
						}),
					);
				if (url.endsWith("/videos/video-1/recommended"))
					return makeJsonResponse([]);
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);
		window.localStorage.setItem(
			"atoman:video-progress:video-1",
			JSON.stringify({
				time_sec: 84,
				duration_sec: 120,
				updated_at: "2026-06-30T00:00:00Z",
			}),
		);
		const play = vi
			.spyOn(HTMLMediaElement.prototype, "play")
			.mockResolvedValue(undefined);

		const { wrapper } = await mountVideoDetail("/videos/watch/video-1", false);
		const video = wrapper.get("video");
		Object.defineProperty(video.element, "duration", {
			configurable: true,
			value: 120,
		});
		await video.trigger("loadedmetadata");
		await flushPromises();
		await wrapper.get('[data-testid="video-resume-restart"]').trigger("click");
		await flushPromises();

		expect((video.element as HTMLVideoElement).currentTime).toBe(0);
		expect(play).toHaveBeenCalled();
		expect(
			window.localStorage.getItem("atoman:video-progress:video-1"),
		).toBeNull();
	});

	it("视频深链优先于已保存的观看进度", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (init?.method === "POST" && url.endsWith("/view"))
					return makeJsonResponse({});
				if (url.endsWith("/videos/video-1"))
					return makeJsonResponse(
						makeVideo("video-1", "本地视频", {
							storage_type: "local",
							duration_sec: 120,
						}),
					);
				if (url.endsWith("/videos/video-1/recommended"))
					return makeJsonResponse([]);
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);
		window.localStorage.setItem(
			"atoman:video-progress:video-1",
			JSON.stringify({
				time_sec: 84,
				duration_sec: 120,
				updated_at: "2026-06-30T00:00:00Z",
			}),
		);

		const { wrapper } = await mountVideoDetail(
			"/videos/watch/video-1?t=40",
			false,
		);
		const video = wrapper.get("video");
		Object.defineProperty(video.element, "duration", {
			configurable: true,
			value: 120,
		});
		await video.trigger("loadedmetadata");
		await flushPromises();

		expect((video.element as HTMLVideoElement).currentTime).toBe(40);
		expect(wrapper.find('[data-testid="video-resume-prompt"]').exists()).toBe(
			false,
		);
	});

	it("登录用户优先使用服务端观看进度", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (init?.method === "POST" && url.endsWith("/content/events"))
					return makeJsonResponse({});
				if (init?.method === "POST" && url.endsWith("/view"))
					return makeJsonResponse({});
				if (url.endsWith("/content/progress/video/video-1"))
					return makeJsonResponse({ data: { position_sec: 84 } });
				if (url.endsWith("/videos/video-1"))
					return makeJsonResponse(
						makeVideo("video-1", "本地视频", {
							storage_type: "local",
							duration_sec: 120,
						}),
					);
				if (url.endsWith("/videos/video-1/recommended"))
					return makeJsonResponse([]);
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);
		window.localStorage.setItem(
			"atoman:video-progress:video-1",
			JSON.stringify({
				time_sec: 24,
				duration_sec: 120,
				updated_at: "2026-06-30T00:00:00Z",
			}),
		);

		const { wrapper } = await mountVideoDetail();
		const video = wrapper.get("video");
		Object.defineProperty(video.element, "duration", {
			configurable: true,
			value: 120,
		});
		await video.trigger("loadedmetadata");
		await flushPromises();

		expect(wrapper.get('[data-testid="video-resume-prompt"]').text()).toContain(
			"1:24",
		);
	});

	it("从头播放会将登录用户的服务端进度重置为零", async () => {
		let savedProgress: Record<string, unknown> | null = null;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (init?.method === "POST" && url.endsWith("/content/events"))
					return makeJsonResponse({});
				if (init?.method === "PUT" && url.endsWith("/content/progress")) {
					savedProgress = JSON.parse(String(init.body));
					return makeJsonResponse({});
				}
				if (url.endsWith("/content/progress/video/video-1"))
					return makeJsonResponse({ data: { position_sec: 84 } });
				if (url.endsWith("/videos/video-1"))
					return makeJsonResponse(
						makeVideo("video-1", "本地视频", {
							storage_type: "local",
							duration_sec: 120,
						}),
					);
				if (url.endsWith("/videos/video-1/recommended"))
					return makeJsonResponse([]);
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);

		const { wrapper } = await mountVideoDetail();
		const video = wrapper.get("video");
		Object.defineProperty(video.element, "duration", {
			configurable: true,
			value: 120,
		});
		await video.trigger("loadedmetadata");
		await flushPromises();
		await wrapper.get('[data-testid="video-resume-restart"]').trigger("click");
		await flushPromises();

		expect(savedProgress).toMatchObject({
			module: "video",
			content_id: "video-1",
			position_sec: 0,
			duration_sec: 120,
			progress: 0,
			completed: false,
		});
	});

	it("本地视频播放被浏览器拒绝时显示重试错误", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (init?.method === "POST" && url.endsWith("/view"))
					return makeJsonResponse({});
				if (url.endsWith("/videos/video-1"))
					return makeJsonResponse(
						makeVideo("video-1", "本地视频", { storage_type: "local" }),
					);
				if (url.endsWith("/videos/video-1/recommended"))
					return makeJsonResponse([]);
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);
		vi
			.spyOn(HTMLMediaElement.prototype, "play")
			.mockRejectedValue(new DOMException("blocked", "NotAllowedError"));

		const { wrapper } = await mountVideoDetail();
		await wrapper.get('[data-testid="video-play"]').trigger("click");
		await flushPromises();

		expect(wrapper.text()).toContain("无法开始播放，请重试");
		expect(wrapper.find(".vd-player-error button").text()).toBe("重试播放");
	});

	it("分享视频时只使用客户端分享能力，不请求不存在的 share 接口", async () => {
		const share = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "share", {
			configurable: true,
			value: share,
		});

		const { wrapper } = await mountVideoDetail();
		await wrapper.get('[data-testid="video-share"]').trigger("click");

		expect(share).toHaveBeenCalledWith({
			title: "当前视频",
			url: window.location.href,
		});
		expect(vi.mocked(fetch)).not.toHaveBeenCalledWith(
			"/api/v1/videos/video-1/share",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("路由 id 快速切换时忽略过期详情响应", async () => {
		const firstVideo = deferred<Response>();
		const firstRecommended = deferred<Response>();
		const secondVideo = deferred<Response>();
		const secondRecommended = deferred<Response>();

		vi.stubGlobal(
			"fetch",
			vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (init?.method === "POST" && url.endsWith("/view"))
					return Promise.resolve(makeJsonResponse({}));
				if (url.endsWith("/videos/first")) return firstVideo.promise;
				if (url.endsWith("/videos/first/recommended"))
					return firstRecommended.promise;
				if (url.endsWith("/videos/second")) return secondVideo.promise;
				if (url.endsWith("/videos/second/recommended"))
					return secondRecommended.promise;
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);

		const { wrapper, router } = await mountVideoDetail("/videos/watch/first");
		await router.push("/videos/watch/second");

		secondVideo.resolve(makeJsonResponse(makeVideo("second", "当前视频")));
		secondRecommended.resolve(
			makeJsonResponse([makeVideo("second-rec", "当前推荐")]),
		);
		await flushPromises();
		expect(wrapper.text()).toContain("当前视频");
		expect(wrapper.text()).toContain("当前推荐");

		firstVideo.resolve(makeJsonResponse(makeVideo("first", "过期视频")));
		firstRecommended.resolve(
			makeJsonResponse([makeVideo("first-rec", "过期推荐")]),
		);
		await flushPromises();

		expect(wrapper.text()).toContain("当前视频");
		expect(wrapper.text()).toContain("当前推荐");
		expect(wrapper.text()).not.toContain("过期视频");
		expect(wrapper.text()).not.toContain("过期推荐");
	});

	it("keeps a valid collection query for playlist navigation and excludes its videos from recommendations", async () => {
		const collection = { id: "collection-1", name: "设计入门" };
		const current = makeVideo("video-1", "当前视频", {
			collection_id: collection.id,
			collection,
			collections: [collection],
		});
		const next = makeVideo("video-2", "合集下一集", {
			collection_id: collection.id,
			collection,
			collections: [collection],
		});
		const outside = makeVideo("video-3", "站外推荐");
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (init?.method === "POST" && url.endsWith("/view"))
					return makeJsonResponse({});
				if (url.endsWith("/videos/video-1")) return makeJsonResponse(current);
				if (url.endsWith("/videos/video-1/recommended"))
					return makeJsonResponse([next, outside]);
				if (url.endsWith("/videos?collection_id=collection-1"))
					return makeJsonResponse([current, next]);
				if (url.endsWith("/videos/video-2")) return makeJsonResponse(next);
				if (url.endsWith("/videos/video-2/recommended"))
					return makeJsonResponse([]);
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);

		const { wrapper, router } = await mountVideoDetail(
			"/videos/watch/video-1?collection=collection-1",
		);
		const playlist = wrapper.getComponent(VideoCollectionPlaylistStub);
		expect(playlist.props("collection")).toMatchObject(collection);
		expect(playlist.props("videos")).toEqual([current, next]);
		expect(
			wrapper.getComponent(VideoRecommendationRowStub).props("videos"),
		).toEqual([outside]);

		playlist.vm.$emit("select", "video-2");
		await flushPromises();
		expect(router.currentRoute.value.fullPath).toBe(
			"/videos/watch/video-2?collection=collection-1",
		);
	});

	it("cancels an ended-video countdown when the viewer manually selects a collection video", async () => {
		vi.useFakeTimers();
		const collection = { id: "collection-1", name: "设计入门" };
		const current = makeVideo("video-1", "当前视频", {
			storage_type: "local", collection_id: collection.id, collection, collections: [collection],
		});
		const next = makeVideo("video-2", "手动选择的视频", {
			storage_type: "local", collection_id: collection.id, collection, collections: [collection],
		});
		const afterNext = makeVideo("video-3", "不应自动跳转的视频", {
			storage_type: "local", collection_id: collection.id, collection, collections: [collection],
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (init?.method === "POST" && url.endsWith("/view")) return makeJsonResponse({});
				if (url.endsWith("/videos/video-1")) return makeJsonResponse(current);
				if (url.endsWith("/videos/video-1/recommended")) return makeJsonResponse([]);
				if (url.endsWith("/videos/video-2")) return makeJsonResponse(next);
				if (url.endsWith("/videos/video-2/recommended")) return makeJsonResponse([]);
				if (url.endsWith("/videos?collection_id=collection-1")) return makeJsonResponse([current, next, afterNext]);
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);

		const { wrapper, router } = await mountVideoDetail("/videos/watch/video-1?collection=collection-1");
		await wrapper.get("video").trigger("ended");
		wrapper.getComponent(VideoCollectionPlaylistStub).vm.$emit("select", "video-2");
		await flushPromises();
		await vi.advanceTimersByTimeAsync(3_000);
		await flushPromises();

		expect(router.currentRoute.value.fullPath).toBe("/videos/watch/video-2?collection=collection-1");
		vi.useRealTimers();
	});

	it("falls back to the author-selected primary collection when the query collection omits the video", async () => {
		const primary = { id: "collection-primary", name: "主合集" };
		const current = makeVideo("video-1", "当前视频", {
			collection_id: primary.id,
			collection: primary,
			collections: [primary],
		});
		const primaryNext = makeVideo("video-2", "主合集下一集", {
			collection_id: primary.id,
			collection: primary,
			collections: [primary],
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (init?.method === "POST" && url.endsWith("/view"))
					return makeJsonResponse({});
				if (url.endsWith("/videos/video-1")) return makeJsonResponse(current);
				if (url.endsWith("/videos/video-1/recommended"))
					return makeJsonResponse([]);
				if (url.endsWith("/videos?collection_id=collection-missing"))
					return makeJsonResponse([]);
				if (url.endsWith("/videos?collection_id=collection-primary"))
					return makeJsonResponse([current, primaryNext]);
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);

		const { wrapper } = await mountVideoDetail(
			"/videos/watch/video-1?collection=collection-missing",
		);
		expect(
			wrapper.getComponent(VideoCollectionPlaylistStub).props("collection"),
		).toMatchObject(primary);
		expect(vi.mocked(fetch).mock.calls.map(([input]) => String(input))).toContain(
			"/api/v1/videos?collection_id=collection-missing",
		);
		expect(vi.mocked(fetch).mock.calls.map(([input]) => String(input))).toContain(
			"/api/v1/videos?collection_id=collection-primary",
		);
	});

	it("opens comments in the shared right sheet and keeps the rating control in the interaction row", async () => {
		const { wrapper } = await mountVideoDetail();

		const comments = wrapper.getComponent(CommentSideSheetStub);
		expect(comments.props("show")).toBe(false);
		expect(
			wrapper.getComponent(PostRatingControlStub).props("weightedRatingActive"),
		).toBe(false);
		await wrapper.get('[data-testid="video-comments"]').trigger("click");
		expect(comments.props("show")).toBe(true);
		expect(comments.props("partialAnchor")).toBeInstanceOf(HTMLElement);
		expect(wrapper.find('[data-test="video-comment-sheet"]').exists()).toBe(true);
		expect(comments.props("target")).toEqual({
			kind: "video",
			resourceId: "video-1",
		});
	});

	it("评论抽屉的数量变化会同步互动计数", async () => {
		const { wrapper } = await mountVideoDetail();
		await wrapper.get('[data-testid="video-comments"]').trigger("click");
		const comments = wrapper.findComponent(CommentSideSheetStub);
		comments.vm.$emit("count-change", 3);
		await wrapper.vm.$nextTick();

		expect(mocks.interactions.commentCount.value).toBe(3);
	});
});

describe("VideoDetailView layout", () => {
	it("PVideoPlayerShell component is importable", async () => {
		const { default: PVideoPlayerShell } = await import(
			"@/components/shared/PVideoPlayerShell.vue"
		);
		expect(PVideoPlayerShell).toBeDefined();
	});
});
