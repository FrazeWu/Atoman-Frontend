import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

// @ts-expect-error Vue test files are outside the app tsconfig shim scope.
import ChannelView from "../../../../src/views/blog/ChannelView.vue";
import { useAuthStore } from "../../../../src/stores/auth";

const routeState = vi.hoisted(() => ({
	route: { params: { id: "channel-1" } },
}));

vi.mock("vue-router", async () => {
	const { reactive } = await import("vue");
	routeState.route = reactive(routeState.route);
	return {
		useRoute: () => routeState.route,
		RouterLink: { template: "<a><slot /></a>" },
	};
});

vi.mock("@/router/siteContext", () => ({
	resolveSiteContext: () => ({ type: "module" }),
	isLocalHost: () => true,
}));

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((nextResolve) => {
		resolve = nextResolve;
	});
	return { promise, resolve };
}

const response = (data: unknown) =>
	new Response(JSON.stringify(data), { status: 200 });

const channel = (id: string, name: string) => ({
	id,
	user_id: "other-user",
	name,
	slug: id,
});
const collection = (id: string, name: string) => ({
	id,
	name,
	description: "",
	channel_id: id.replace("collection-", "channel-"),
});
const post = (id: string, channelId: string, title: string) => ({
	id,
	user_id: "other-user",
	channel_id: channelId,
	title,
	content: "正文",
	status: "published",
	visibility: "public",
	allow_comments: true,
	pinned: false,
	created_at: "2026-06-15T00:00:00Z",
	updated_at: "2026-06-15T00:00:00Z",
});

describe("ChannelView", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		routeState.route.params.id = "channel-1";
		window.history.replaceState(null, "", "/posts/channel/channel-1?site=blog");

		const authStore = useAuthStore();
		authStore.token = "token";
		authStore.user = {
			uuid: "user-1",
			username: "fafa",
			email: "fafa@example.com",
		};
		authStore.isAuthenticated = true;
	});

	it("路由从 A 切到 B 时重新请求并立即清空 A 的频道派生状态", async () => {
		const channelB = deferred<Response>();
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const url = String(input);
			if (
				url.includes("/blog/channels/slug/channel-1") &&
				!url.includes("/collections")
			) {
				return response({ data: channel("channel-1", "频道 A") });
			}
			if (url.includes("/blog/channels/slug/channel-1/collections")) {
				return response({ data: [collection("collection-1", "合集 A")] });
			}
			if (
				url.includes("/blog/posts?") &&
				url.includes("channel_id=channel-1")
			) {
				return response({ data: [post("post-1", "channel-1", "文章 A")] });
			}
			if (url.includes("/feed/subscribe/channel/channel-1/status"))
				return response({ subscribed: true });
			if (url.includes("/blog/bookmarks")) return response({ data: [] });
			if (url.includes("/feed/reading-list")) return response({ items: [] });
			if (
				url.includes("/blog/channels/slug/channel-2") &&
				!url.includes("/collections")
			)
				return channelB.promise;
			if (url.includes("/blog/channels/slug/channel-2/collections"))
				return response({ data: [collection("collection-2", "合集 B")] });
			if (url.includes("/blog/posts?") && url.includes("channel_id=channel-2"))
				return response({ data: [post("post-2", "channel-2", "文章 B")] });
			if (url.includes("/feed/subscribe/channel/channel-2/status"))
				return response({ subscribed: false });
			throw new Error(`unexpected request: ${url}`);
		});

		const wrapper = mount(ChannelView);
		await flushPromises();
		expect(wrapper.vm.$.setupState.channel.name).toBe("频道 A");
		expect(wrapper.vm.$.setupState.collections).toHaveLength(1);
		expect(wrapper.vm.$.setupState.channelPosts).toHaveLength(1);
		expect(wrapper.vm.$.setupState.channelSubscribed).toBe(true);

		routeState.route.params.id = "channel-2";
		await flushPromises();

		expect(wrapper.vm.$.setupState.loading).toBe(true);
		expect(wrapper.vm.$.setupState.channel).toBeNull();
		expect(wrapper.vm.$.setupState.collections).toEqual([]);
		expect(wrapper.vm.$.setupState.channelPosts).toEqual([]);
		expect(wrapper.vm.$.setupState.channelSubscribed).toBe(false);

		channelB.resolve(response({ data: channel("channel-2", "频道 B") }));
		await flushPromises();
		expect(wrapper.vm.$.setupState.channel.name).toBe("频道 B");
		expect(wrapper.vm.$.setupState.collections[0].name).toBe("合集 B");
		expect(wrapper.vm.$.setupState.channelPosts[0].title).toBe("文章 B");
		expect(wrapper.vm.$.setupState.channelSubscribed).toBe(false);
		wrapper.unmount();
	});

	it("A 的迟到频道响应不能覆盖已加载的 B", async () => {
		const channelA = deferred<Response>();
		const channelB = deferred<Response>();
		vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
			const url = String(input);
			if (
				url.includes("/blog/channels/slug/channel-1") &&
				!url.includes("/collections")
			)
				return channelA.promise;
			if (
				url.includes("/blog/channels/slug/channel-2") &&
				!url.includes("/collections")
			)
				return channelB.promise;
			if (url.includes("/blog/channels/slug/channel-2/collections"))
				return Promise.resolve(response({ data: [] }));
			if (url.includes("/blog/posts?") && url.includes("channel_id=channel-2"))
				return Promise.resolve(response({ data: [] }));
			if (url.includes("/feed/subscribe/channel/channel-2/status"))
				return Promise.resolve(response({ subscribed: false }));
			if (url.includes("/blog/bookmarks"))
				return Promise.resolve(response({ data: [] }));
			if (url.includes("/feed/reading-list"))
				return Promise.resolve(response({ items: [] }));
			throw new Error(`unexpected request: ${url}`);
		});

		const wrapper = mount(ChannelView);
		routeState.route.params.id = "channel-2";
		await flushPromises();

		channelB.resolve(response({ data: channel("channel-2", "频道 B") }));
		await flushPromises();
		expect(wrapper.vm.$.setupState.channel.name).toBe("频道 B");

		channelA.resolve(response({ data: channel("channel-1", "频道 A") }));
		await flushPromises();
		expect(wrapper.vm.$.setupState.channel.name).toBe("频道 B");
		wrapper.unmount();
	});

	it("A 的迟到合集和文章响应不能覆盖已加载的 B", async () => {
		const collectionsA = deferred<Response>();
		const postsA = deferred<Response>();
		vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
			const url = String(input);
			if (
				url.includes("/blog/channels/slug/channel-1") &&
				!url.includes("/collections")
			) {
				return Promise.resolve(
					response({ data: channel("channel-1", "频道 A") }),
				);
			}
			if (url.includes("/blog/channels/slug/channel-1/collections"))
				return collectionsA.promise;
			if (url.includes("/blog/posts?") && url.includes("channel_id=channel-1"))
				return postsA.promise;
			if (url.includes("/feed/subscribe/channel/channel-1/status"))
				return Promise.resolve(response({ subscribed: false }));
			if (
				url.includes("/blog/channels/slug/channel-2") &&
				!url.includes("/collections")
			) {
				return Promise.resolve(
					response({ data: channel("channel-2", "频道 B") }),
				);
			}
			if (url.includes("/blog/channels/slug/channel-2/collections")) {
				return Promise.resolve(
					response({ data: [collection("collection-2", "合集 B")] }),
				);
			}
			if (
				url.includes("/blog/posts?") &&
				url.includes("channel_id=channel-2")
			) {
				return Promise.resolve(
					response({ data: [post("post-2", "channel-2", "文章 B")] }),
				);
			}
			if (url.includes("/feed/subscribe/channel/channel-2/status"))
				return Promise.resolve(response({ subscribed: false }));
			if (url.includes("/blog/bookmarks"))
				return Promise.resolve(response({ data: [] }));
			if (url.includes("/feed/reading-list"))
				return Promise.resolve(response({ items: [] }));
			throw new Error(`unexpected request: ${url}`);
		});

		const wrapper = mount(ChannelView);
		await flushPromises();
		routeState.route.params.id = "channel-2";
		await flushPromises();

		expect(wrapper.vm.$.setupState.collections[0].name).toBe("合集 B");
		expect(wrapper.vm.$.setupState.channelPosts[0].title).toBe("文章 B");

		collectionsA.resolve(
			response({ data: [collection("collection-1", "合集 A")] }),
		);
		postsA.resolve(response({ data: [post("post-1", "channel-1", "文章 A")] }));
		await flushPromises();

		expect(wrapper.vm.$.setupState.collections[0].name).toBe("合集 B");
		expect(wrapper.vm.$.setupState.channelPosts[0].title).toBe("文章 B");
		wrapper.unmount();
	});

	it("从已选中的 A 合集切换到 B 时同步清空 activeCollectionId", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const url = String(input);
			if (
				url.includes("/blog/channels/slug/channel-1") &&
				!url.includes("/collections")
			) {
				return response({ data: channel("channel-1", "频道 A") });
			}
			if (url.includes("/blog/channels/slug/channel-1/collections")) {
				return response({ data: [collection("collection-1", "合集 A")] });
			}
			if (
				url.includes("/blog/posts?") &&
				url.includes("channel_id=channel-1")
			) {
				return response({ data: [post("post-1", "channel-1", "文章 A")] });
			}
			if (url.includes("/feed/subscribe/channel/channel-1/status"))
				return response({ subscribed: false });
			if (
				url.includes("/blog/channels/slug/channel-2") &&
				!url.includes("/collections")
			) {
				return response({ data: channel("channel-2", "频道 B") });
			}
			if (url.includes("/blog/channels/slug/channel-2/collections"))
				return response({ data: [] });
			if (url.includes("/blog/posts?") && url.includes("channel_id=channel-2"))
				return response({ data: [] });
			if (url.includes("/feed/subscribe/channel/channel-2/status"))
				return response({ subscribed: false });
			if (url.includes("/blog/bookmarks")) return response({ data: [] });
			if (url.includes("/feed/reading-list")) return response({ items: [] });
			throw new Error(`unexpected request: ${url}`);
		});

		const wrapper = mount(ChannelView);
		await flushPromises();
		wrapper.vm.$.setupState.activeCollectionId = "collection-1";
		expect(wrapper.vm.$.setupState.activeCollectionId).toBe("collection-1");

		routeState.route.params.id = "channel-2";
		await flushPromises();

		expect(wrapper.vm.$.setupState.activeCollectionId).toBeNull();
		wrapper.unmount();
	});

	it("A 的迟到第二页文章响应不会污染已加载的 B", async () => {
		const postsASecondPage = deferred<Response>();
		vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
			const url = String(input);
			if (
				url.includes("/blog/channels/slug/channel-1") &&
				!url.includes("/collections")
			) {
				return Promise.resolve(
					response({ data: channel("channel-1", "频道 A") }),
				);
			}
			if (url.includes("/blog/channels/slug/channel-1/collections"))
				return Promise.resolve(response({ data: [] }));
			if (
				url.includes("/blog/posts?") &&
				url.includes("channel_id=channel-1") &&
				url.includes("page=1")
			) {
				return Promise.resolve(
					response({
						data: [post("post-1", "channel-1", "文章 A 第一页")],
						meta: { has_more: true },
					}),
				);
			}
			if (
				url.includes("/blog/posts?") &&
				url.includes("channel_id=channel-1") &&
				url.includes("page=2")
			)
				return postsASecondPage.promise;
			if (url.includes("/feed/subscribe/channel/channel-1/status"))
				return Promise.resolve(response({ subscribed: false }));
			if (
				url.includes("/blog/channels/slug/channel-2") &&
				!url.includes("/collections")
			) {
				return Promise.resolve(
					response({ data: channel("channel-2", "频道 B") }),
				);
			}
			if (url.includes("/blog/channels/slug/channel-2/collections"))
				return Promise.resolve(response({ data: [] }));
			if (
				url.includes("/blog/posts?") &&
				url.includes("channel_id=channel-2")
			) {
				return Promise.resolve(
					response({ data: [post("post-2", "channel-2", "文章 B")] }),
				);
			}
			if (url.includes("/feed/subscribe/channel/channel-2/status"))
				return Promise.resolve(response({ subscribed: false }));
			if (url.includes("/blog/bookmarks"))
				return Promise.resolve(response({ data: [] }));
			if (url.includes("/feed/reading-list"))
				return Promise.resolve(response({ items: [] }));
			throw new Error(`unexpected request: ${url}`);
		});

		const wrapper = mount(ChannelView);
		await flushPromises();
		wrapper.vm.$.setupState.loadMorePosts();
		await flushPromises();
		routeState.route.params.id = "channel-2";
		await flushPromises();
		expect(
			wrapper.vm.$.setupState.channelPosts.map(
				(item: { title: string }) => item.title,
			),
		).toEqual(["文章 B"]);

		postsASecondPage.resolve(
			response({
				data: [post("post-3", "channel-1", "文章 A 第二页")],
				meta: { has_more: false },
			}),
		);
		await flushPromises();

		expect(
			wrapper.vm.$.setupState.channelPosts.map(
				(item: { title: string }) => item.title,
			),
		).toEqual(["文章 B"]);
		wrapper.unmount();
	});

	it.each([
		["频道 JSON 解析拒绝", "channel"],
		["订阅状态查询拒绝", "subscription"],
		["合集 JSON 解析拒绝", "collections"],
		["文章 JSON 解析拒绝", "posts"],
	] as const)("%s 不会产生未处理拒绝或污染状态", async (_name, failure) => {
		const jsonRejectingResponse = () =>
			({
				ok: true,
				json: vi.fn().mockRejectedValue(new Error(`${failure} json failed`)),
			}) as unknown as Response;
		const unhandledRejections: PromiseRejectionEvent[] = [];
		const onUnhandledRejection = (event: PromiseRejectionEvent) =>
			unhandledRejections.push(event);
		window.addEventListener("unhandledrejection", onUnhandledRejection);

		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const url = String(input);
			if (
				url.includes("/blog/channels/slug/channel-1") &&
				!url.includes("/collections")
			) {
				return failure === "channel"
					? jsonRejectingResponse()
					: response({ data: channel("channel-1", "频道 A") });
			}
			if (url.includes("/feed/subscribe/channel/channel-1/status")) {
				return failure === "subscription"
					? Promise.reject(new Error("subscription request failed"))
					: response({ subscribed: true });
			}
			if (url.includes("/blog/channels/slug/channel-1/collections")) {
				return failure === "collections"
					? jsonRejectingResponse()
					: response({ data: [collection("collection-1", "合集 A")] });
			}
			if (
				url.includes("/blog/posts?") &&
				url.includes("channel_id=channel-1")
			) {
				return failure === "posts"
					? jsonRejectingResponse()
					: response({ data: [post("post-1", "channel-1", "文章 A")] });
			}
			if (url.includes("/blog/bookmarks")) return response({ data: [] });
			if (url.includes("/feed/reading-list")) return response({ items: [] });
			throw new Error(`unexpected request: ${url}`);
		});

		const wrapper = mount(ChannelView);
		await flushPromises();
		await Promise.resolve();

		expect(unhandledRejections).toEqual([]);
		if (failure === "channel") {
			expect(wrapper.vm.$.setupState.channel).toBeNull();
			expect(wrapper.vm.$.setupState.collections).toEqual([]);
			expect(wrapper.vm.$.setupState.channelPosts).toEqual([]);
		} else if (failure === "subscription") {
			expect(wrapper.vm.$.setupState.channel.name).toBe("频道 A");
			expect(wrapper.vm.$.setupState.channelSubscribed).toBe(false);
			expect(wrapper.vm.$.setupState.channelSubscribeLoading).toBe(false);
			expect(wrapper.vm.$.setupState.collections[0].name).toBe("合集 A");
			expect(wrapper.vm.$.setupState.channelPosts[0].title).toBe("文章 A");
		} else if (failure === "collections") {
			expect(wrapper.vm.$.setupState.channel.name).toBe("频道 A");
			expect(wrapper.vm.$.setupState.collections).toEqual([]);
			expect(wrapper.vm.$.setupState.channelPosts[0].title).toBe("文章 A");
		} else {
			expect(wrapper.vm.$.setupState.channel.name).toBe("频道 A");
			expect(wrapper.vm.$.setupState.collections[0].name).toBe("合集 A");
			expect(wrapper.vm.$.setupState.channelPosts).toEqual([]);
		}

		window.removeEventListener("unhandledrejection", onUnhandledRejection);
		wrapper.unmount();
	});

	it("频道加载链请求失败时不会向调用方传播拒绝", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = String(input);
				if (
					url.includes("/blog/channels/slug/channel-1") &&
					!url.includes("/collections")
				) {
					return response({ data: channel("channel-1", "频道 A") });
				}
				if (url.includes("/feed/subscribe/channel/channel-1/status"))
					return response({ subscribed: false });
				if (url.includes("/blog/channels/slug/channel-1/collections"))
					return response({ data: [] });
				if (url.includes("/blog/posts?")) return response({ data: [] });
				if (url.includes("/blog/bookmarks")) return response({ data: [] });
				if (url.includes("/feed/reading-list")) return response({ items: [] });
				throw new Error(`unexpected request: ${url}`);
			});

		const wrapper = mount(ChannelView);
		await flushPromises();
		const state = wrapper.vm.$.setupState;
		const loadedChannel = state.channel;

		fetchSpy.mockRejectedValueOnce(new Error("channel network failed"));
		await expect(state.fetchChannel("channel-1", true, 1)).resolves.toBeNull();

		fetchSpy.mockRejectedValueOnce(new Error("collections network failed"));
		await expect(
			state.fetchCollections(loadedChannel, "channel-1", true, 1),
		).resolves.toBeUndefined();

		fetchSpy.mockResolvedValueOnce(new Response(null, { status: 503 }));
		await expect(state.fetchPosts(loadedChannel, 1)).resolves.toBeUndefined();
		wrapper.unmount();
	});

	it("A 的迟到订阅成功不能覆盖 B 或清除 B 的订阅加载状态", async () => {
		const subscribeA = deferred<Response>();
		const subscriptionStatusB = deferred<Response>();
		vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
			const url = String(input);
			if (
				url.includes("/blog/channels/slug/channel-1") &&
				!url.includes("/collections")
			) {
				return Promise.resolve(
					response({ data: channel("channel-1", "频道 A") }),
				);
			}
			if (
				url.includes("/blog/channels/slug/channel-2") &&
				!url.includes("/collections")
			) {
				return Promise.resolve(
					response({ data: channel("channel-2", "频道 B") }),
				);
			}
			if (url.includes("/blog/channels/slug/") && url.includes("/collections"))
				return Promise.resolve(response({ data: [] }));
			if (url.includes("/blog/posts?"))
				return Promise.resolve(response({ data: [] }));
			if (url.includes("/feed/subscribe/channel/channel-1/status"))
				return Promise.resolve(response({ subscribed: false }));
			if (url.includes("/feed/subscribe/channel/channel-2/status"))
				return subscriptionStatusB.promise;
			if (
				url.includes("/feed/subscribe/channel/channel-1") &&
				init?.method === "POST"
			)
				return subscribeA.promise;
			if (url.includes("/blog/bookmarks"))
				return Promise.resolve(response({ data: [] }));
			if (url.includes("/feed/reading-list"))
				return Promise.resolve(response({ items: [] }));
			throw new Error(`unexpected request: ${url}`);
		});

		const wrapper = mount(ChannelView);
		await flushPromises();
		void wrapper.vm.$.setupState.toggleChannelSubscribe();
		await flushPromises();

		routeState.route.params.id = "channel-2";
		await flushPromises();
		expect(wrapper.vm.$.setupState.channel.id).toBe("channel-2");
		expect(wrapper.vm.$.setupState.channelSubscribeLoading).toBe(true);

		subscribeA.resolve(response({}));
		await flushPromises();

		expect(wrapper.vm.$.setupState.channelSubscribed).toBe(false);
		expect(wrapper.vm.$.setupState.channelSubscribeLoading).toBe(true);

		subscriptionStatusB.resolve(response({ subscribed: false }));
		await flushPromises();
		wrapper.unmount();
	});

	it("turns 收藏 into 取消收藏 after saving a channel post", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			const url = String(input);
			if (
				url.includes("/blog/channels/slug/channel-1") &&
				!url.includes("/collections")
			) {
				return new Response(
					JSON.stringify({
						data: {
							id: "channel-1",
							user_id: "user-1",
							name: "频道",
							slug: "channel-1",
						},
					}),
					{ status: 200 },
				);
			}
			if (url.includes("/blog/channels/slug/channel-1/collections")) {
				return new Response(JSON.stringify({ data: [] }), { status: 200 });
			}
			if (url.includes("/blog/posts?")) {
				return new Response(
					JSON.stringify({
						data: [
							{
								id: "post-1",
								user_id: "user-1",
								channel_id: "channel-1",
								title: "文章",
								content: "正文",
								status: "published",
								visibility: "public",
								allow_comments: true,
								pinned: false,
								created_at: "2026-06-15T00:00:00Z",
								updated_at: "2026-06-15T00:00:00Z",
							},
						],
					}),
					{ status: 200 },
				);
			}
			if (url.includes("/blog/bookmarks") && init?.method === "POST") {
				return new Response(
					JSON.stringify({ data: { id: "bookmark-1", post_id: "post-1" } }),
					{ status: 201 },
				);
			}
			if (url.includes("/blog/bookmarks")) {
				return new Response(JSON.stringify({ data: [] }), { status: 200 });
			}
			if (url.includes("/feed/reading-list")) {
				return new Response(JSON.stringify({ items: [] }), { status: 200 });
			}
			return new Response(JSON.stringify({ error: "unexpected request" }), {
				status: 404,
			});
		});

		const wrapper = mount(ChannelView, {
			global: {
				stubs: {
					PEmpty: true,
					PPageHeader: true,
					PModal: true,
					PToast: true,
					PCard: true,
					PSurface: { template: "<section><slot /></section>" },
					PAvatar: true,
					PTab: true,
					PPress: true,
					PLink: true,
					PContentCard: {
						props: ["title", "summary"],
						template:
							'<article><h3>{{ title }}</h3><div @click.stop><slot name="actions" /></div></article>',
					},
					BlogItemCard: {
						props: ["bookmarked"],
						emits: ["toggle-bookmark"],
						template:
							"<article><button type=\"button\" @click=\"$emit('toggle-bookmark')\">{{ bookmarked ? '取消收藏' : '收藏' }}</button></article>",
					},
					PClip: {
						props: ["label", "active"],
						emits: ["click"],
						template:
							'<button type="button" :data-active="active" @click="$emit(\'click\', $event)">{{ label }}</button>',
					},
				},
			},
		});

		await flushPromises();
		const saveButton = wrapper
			.findAll("button")
			.find((button) => button.text() === "收藏");
		expect(saveButton).toBeTruthy();

		await saveButton!.trigger("click");
		await flushPromises();

		expect(wrapper.findAll("button").map((button) => button.text())).toContain(
			"取消收藏",
		);
		wrapper.unmount();
	});
});
