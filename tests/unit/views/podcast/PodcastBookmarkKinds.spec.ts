import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

// @ts-expect-error Vitest resolves Vue SFC imports through Vite, outside tsconfig's src-only include.
import PodcastEpisodeView from "../../../../src/views/podcast/PodcastEpisodeView.vue";
// @ts-expect-error Vitest resolves Vue SFC imports through Vite, outside tsconfig's src-only include.
import PodcastFavoritesView from "../../../../src/views/podcast/PodcastFavoritesView.vue";
import { useAuthStore } from "../../../../src/stores/auth";
import { usePlayerStore } from "../../../../src/stores/player";

const CommentSideSheetStub = {
	name: "CommentSideSheet",
	props: ["target", "currentTime"],
	emits: ["seek"],
	template: "<div />",
};

const response = (data: unknown = {}, status = 200) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

function mountFavoritesView() {
	return mount(PodcastFavoritesView, {
		global: {
			stubs: {
				PPageHeader: true,
				PEmpty: true,
				RouterLink: { template: "<a><slot /></a>" },
			},
		},
	});
}

describe("podcast bookmark kinds", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		useAuthStore().token = "test-token";
	});

	it("sends the selected kind when favoriting or adding an episode to listen later", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.endsWith("/podcast/episodes/episode-1")) {
					return response({
						id: "episode-1",
						audio_url: "https://cdn.example.com/episode.mp3",
						post: { title: "测试单集", content: "" },
					});
				}
				return response();
			});
		const player = usePlayerStore();
		player.currentSong = {
			source_type: "podcast_episode",
			source_id: "episode-1",
		} as never;
		player.currentTime = 84;
		const seek = vi.spyOn(player, "seek").mockImplementation(() => undefined);
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{ path: "/podcasts/episode/:id", component: PodcastEpisodeView },
			],
		});
		await router.push("/podcasts/episode/episode-1");
		await router.isReady();
		const wrapper = mount(PodcastEpisodeView, {
			global: {
				plugins: [router],
				stubs: {
					PPress: {
						props: ["label"],
						emits: ["click"],
						template: "<button @click=\"$emit('click')\">{{ label }}</button>",
					},
					PodcastShownotes: true,
					CommentSideSheet: CommentSideSheetStub,
				},
			},
		});
		await flushPromises();

		const commentSection = wrapper.findComponent(CommentSideSheetStub);
		expect(commentSection.props("target")).toEqual({
			kind: "podcast_episode",
			resourceId: "episode-1",
		});
		expect((commentSection.props("currentTime") as () => number | null)()).toBe(
			84,
		);
		commentSection.vm.$emit("seek", 12);
		expect(seek).toHaveBeenCalledWith(12);

		await wrapper
			.findAll("button")
			.find((button) => button.text() === "收藏")!
			.trigger("click");
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "稍后听")!
			.trigger("click");
		await flushPromises();

		const bodies = fetchMock.mock.calls
			.filter(([input]) => String(input).endsWith("/podcast/bookmarks"))
			.map(([, init]) => JSON.parse(String(init?.body)));
		expect(bodies).toEqual([
			{ episode_id: "episode-1", kind: "favorite" },
			{ episode_id: "episode-1", kind: "listen_later" },
		]);
	});

	it("loads the episode and listen later tabs with their respective kind filters", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async () => response({ data: [] }));
		const wrapper = mountFavoritesView();
		await flushPromises();

		await wrapper
			.findAll("button")
			.find((button) => button.text() === "稍后听")!
			.trigger("click");
		await flushPromises();

		const urls = fetchMock.mock.calls.map(([input]) => String(input));
		expect(urls).toContain("/api/v1/podcast/bookmarks?kind=favorite");
		expect(urls).toContain("/api/v1/podcast/bookmarks?kind=listen_later");
	});

	it("does not let an older request clear the loading state of a newer tab request", async () => {
		const initialEpisodes = deferred<Response>();
		const listenLater = deferred<Response>();
		vi.spyOn(globalThis, "fetch")
			.mockImplementationOnce(() => initialEpisodes.promise)
			.mockImplementationOnce(() => listenLater.promise);
		const wrapper = mountFavoritesView();
		await flushPromises();

		await wrapper
			.findAll("button")
			.find((button) => button.text() === "稍后听")!
			.trigger("click");
		await flushPromises();
		initialEpisodes.resolve(response({ data: [] }));
		await flushPromises();

		expect(wrapper.text()).toContain("加载中...");

		listenLater.resolve(response({ data: [] }));
		await flushPromises();
		expect(wrapper.text()).not.toContain("加载中...");
	});

	it("keeps the later response when returning to the same tab", async () => {
		const firstEpisodes = deferred<Response>();
		const listenLater = deferred<Response>();
		const secondEpisodes = deferred<Response>();
		vi.spyOn(globalThis, "fetch")
			.mockImplementationOnce(() => firstEpisodes.promise)
			.mockImplementationOnce(() => listenLater.promise)
			.mockImplementationOnce(() => secondEpisodes.promise);
		const wrapper = mountFavoritesView();
		await flushPromises();

		await wrapper
			.findAll("button")
			.find((button) => button.text() === "稍后听")!
			.trigger("click");
		await flushPromises();
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "单集")!
			.trigger("click");
		await flushPromises();

		secondEpisodes.resolve(
			response({
				data: [
					{ id: "new", episode: { id: "new", post: { title: "新单集" } } },
				],
			}),
		);
		await flushPromises();
		firstEpisodes.resolve(
			response({
				data: [
					{ id: "old", episode: { id: "old", post: { title: "旧单集" } } },
				],
			}),
		);
		await flushPromises();

		expect(wrapper.text()).toContain("新单集");
		expect(wrapper.text()).not.toContain("旧单集");
		listenLater.resolve(response({ data: [] }));
	});

	it("keeps the current episode bookmarks when reloading returns an HTTP error", async () => {
		vi.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				response({
					data: [
						{
							id: "saved",
							episode: { id: "saved", post: { title: "已收藏单集" } },
						},
					],
				}),
			)
			.mockResolvedValueOnce(response({ data: [] }))
			.mockResolvedValueOnce(response({ message: "服务器错误" }, 500));
		const wrapper = mountFavoritesView();
		await flushPromises();
		expect(wrapper.text()).toContain("已收藏单集");

		await wrapper
			.findAll("button")
			.find((button) => button.text() === "稍后听")!
			.trigger("click");
		await flushPromises();
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "单集")!
			.trigger("click");
		await flushPromises();

		expect(wrapper.text()).toContain("已收藏单集");
		expect(wrapper.text()).not.toContain("加载中...");
	});

	it("ignores a stale request failure without changing the current tab data", async () => {
		const firstEpisodes = deferred<Response>();
		const listenLater = deferred<Response>();
		const secondEpisodes = deferred<Response>();
		vi.spyOn(globalThis, "fetch")
			.mockImplementationOnce(() => firstEpisodes.promise)
			.mockImplementationOnce(() => listenLater.promise)
			.mockImplementationOnce(() => secondEpisodes.promise);
		const wrapper = mountFavoritesView();
		await flushPromises();

		await wrapper
			.findAll("button")
			.find((button) => button.text() === "稍后听")!
			.trigger("click");
		await flushPromises();
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "单集")!
			.trigger("click");
		await flushPromises();

		secondEpisodes.resolve(
			response({
				data: [
					{
						id: "current",
						episode: { id: "current", post: { title: "当前单集" } },
					},
				],
			}),
		);
		await flushPromises();
		firstEpisodes.reject(new Error("旧请求失败"));
		await flushPromises();

		expect(wrapper.text()).toContain("当前单集");
		expect(wrapper.text()).not.toContain("加载中...");
		listenLater.resolve(response({ data: [] }));
	});
});
