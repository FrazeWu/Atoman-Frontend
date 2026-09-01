import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// @ts-expect-error Vitest resolves Vue SFC imports through Vite, outside tsconfig's src-only include.
import BlogPostSheet from "../../../../src/components/blog/BlogPostSheet.vue";
import type { BlogPostLayer } from "../../../../src/components/blog/blogSheetTypes";
import { useBlogSheets } from "../../../../src/composables/useBlogSheets";
import { useAuthStore } from "../../../../src/stores/auth";

const layer: BlogPostLayer = {
	key: "post:post-1",
	kind: "post",
	title: "文章一",
	route: "/posts/post/post-1",
	payload: { postId: "post-1", collectionId: "collection-1" },
};

const response = (data: unknown) =>
	new Response(JSON.stringify({ data }), { status: 200 });

const errorResponse = (status: number, code: string, message: string) =>
	new Response(JSON.stringify({ error: { code, message } }), { status });

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	const promise = new Promise<T>((nextResolve) => {
		resolve = nextResolve;
	});
	return { promise, resolve };
}

const postDetail = (
	id: string,
	title: string,
	overrides: Record<string, unknown> = {},
) => ({
	id,
	user_id: "user-1",
	user: { uuid: "user-1", username: "author" },
	title,
	content: `${title}正文`,
	status: "published",
	visibility: "public",
	created_at: "2026-07-12T00:00:00Z",
	updated_at: "2026-07-13T00:00:00Z",
	...overrides,
});

describe("BlogPostSheet", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				response({
					id: "post-1",
					user_id: "user-1",
					user: { uuid: "user-1", username: "author" },
					channel_id: "channel-1",
					title: "文章一",
					content: "正文",
					created_at: "2026-07-12T00:00:00Z",
					updated_at: "2026-07-13T00:00:00Z",
				}),
			),
		);
	});

	afterEach(() => {
		useBlogSheets().closeAll();
		vi.unstubAllGlobals();
	});

	it("opens the Studio editor and preserves collection context", async () => {
		const pinia = createPinia();
		setActivePinia(pinia);
		const auth = useAuthStore();
		auth.token = "token";
		auth.isAuthenticated = true;
		auth.user = {
			uuid: "user-1",
			username: "author",
			email: "author@example.com",
		};

		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{ path: "/posts", component: { template: "<div />" } },
				{ path: "/studio/blog/:id/edit", component: { template: "<div />" } },
			],
		});
		await router.push("/posts");
		await router.isReady();

		const wrapper = mount(BlogPostSheet, {
			props: { layer },
			global: {
				plugins: [pinia, router],
				stubs: {
					PSheet: { template: "<section><slot /></section>" },
					PButton: {
						emits: ["click"],
						template: "<button @click=\"$emit('click')\"><slot /></button>",
					},
				},
			},
		});
		await flushPromises();

		expect(wrapper.get('[role="note"]').text()).toContain("最近更新时间：");
		expect(wrapper.get('[role="note"]').text()).toMatch(
			/\d{4}年\d+月\d+日，距今已过去 \d+ 周，请注意信息有效性。/,
		);
		await wrapper.get("button").trigger("click");
		await flushPromises();

		expect(router.currentRoute.value.fullPath).toBe(
			"/studio/blog/post-1/edit?channel=channel-1&collection=collection-1",
		);
	});
	it("records an open event after loading the post", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/related")) return response([]);
			if (url.includes("/blog/posts/post-1")) {
				return response(postDetail("post-1", "文章一"));
			}
			return response({ recorded: true });
		});
		vi.stubGlobal("fetch", fetchMock);

		const pinia = createPinia();
		setActivePinia(pinia);
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{ path: "/posts", component: { template: "<div />" } }],
		});
		await router.push("/posts");
		await router.isReady();

		mount(BlogPostSheet, {
			props: { layer },
			global: {
				plugins: [pinia, router],
				stubs: { PSheet: { template: "<section><slot /></section>" } },
			},
		});
		await flushPromises();

		const eventRequest = fetchMock.mock.calls.find(([input]) =>
			String(input).includes("/content/events"),
		);
		expect(eventRequest).toBeDefined();
		expect(eventRequest?.[1]).toMatchObject({ method: "POST" });
		expect(JSON.parse(String(eventRequest?.[1]?.body))).toMatchObject({
			module: "blog",
			content_id: "post-1",
			event: "open",
			source: "blog_sheet",
		});
	});

	it("shows the rating API error instead of a generic retry prompt", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/related")) return response([]);
			if (url.endsWith("/rating"))
				return errorResponse(
					403,
					"blog.post_forbidden",
					"当前没有权限为这篇文章评分",
				);
			if (url.includes("/blog/posts/post-1"))
				return response(postDetail("post-1", "文章一"));
			return response({ recorded: true });
		});
		vi.stubGlobal("fetch", fetchMock);

		const pinia = createPinia();
		setActivePinia(pinia);
		const auth = useAuthStore();
		auth.token = "token";
		auth.isAuthenticated = true;
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{ path: "/posts", component: { template: "<div />" } }],
		});
		await router.push("/posts");
		await router.isReady();

		const wrapper = mount(BlogPostSheet, {
			props: { layer },
			global: {
				plugins: [pinia, router],
				stubs: {
					PSheet: { template: "<section><slot /></section>" },
					PostRatingControl: {
						props: ["errorMessage"],
						emits: ["rate"],
						template:
							'<button data-test="rate" @click="$emit(\'rate\', 7)" /> <p>{{ errorMessage }}</p>',
					},
				},
			},
		});
		await flushPromises();
		await wrapper.get('[data-test="rate"]').trigger("click");
		await flushPromises();

		expect(wrapper.text()).toContain("当前没有权限为这篇文章评分");
		expect(wrapper.text()).not.toContain("评分未保存，请重试");
	});

	it("opens a right-side discussion sheet for the loaded blog post", async () => {
		const pinia = createPinia();
		setActivePinia(pinia);
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{ path: "/posts", component: { template: "<div />" } }],
		});
		await router.push("/posts");
		await router.isReady();
		useBlogSheets().openPost("post-1", "文章一", "collection-1");

		const wrapper = mount(BlogPostSheet, {
			props: { layer },
			global: {
				plugins: [pinia, router],
				stubs: {
					PSheet: {
						props: ["show", "index"],
						template:
							'<section v-if="index === 0 || show" :data-sheet-index="index"><slot /></section>',
					},
					PDiscussionFAB: {
						props: ["count"],
						emits: ["click"],
						template:
							'<button data-test="discussion" @click="$emit(\'click\')">讨论 {{ count }}</button>',
					},
					CommentSection: {
						props: ["target"],
						template:
							'<div data-test="comments">{{ target.kind }}:{{ target.resourceId }}</div>',
					},
				},
			},
		});
		await flushPromises();

		expect(wrapper.find('[data-test="comments"]').exists()).toBe(false);
		const discussion = wrapper.get('[data-test="discussion"]');
		expect(discussion.element.closest('[data-sheet-index="0"]')).not.toBeNull();
		await discussion.trigger("click");
		await flushPromises();

		expect(wrapper.get('[data-test="comments"]').text()).toBe("blog_post:post-1");
	});

	it("ignores a late response after switching to another post", async () => {
		const firstResponse = deferred<Response>();
		vi.stubGlobal(
			"fetch",
			vi.fn((input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes("/blog/posts/post-1")) return firstResponse.promise;
				return Promise.resolve(
					response(postDetail("post-2", "文章二", { content: "正文二" })),
				);
			}),
		);

		const pinia = createPinia();
		setActivePinia(pinia);
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{ path: "/posts", component: { template: "<div />" } }],
		});
		await router.push("/posts");
		await router.isReady();
		const wrapper = mount(BlogPostSheet, {
			props: { layer },
			global: {
				plugins: [pinia, router],
				stubs: {
					PSheet: { template: "<section><slot /></section>" },
					PButton: {
						emits: ["click"],
						template: "<button @click=\"$emit('click')\"><slot /></button>",
					},
				},
			},
		});

		const nextLayer: BlogPostLayer = {
			...layer,
			key: "post:post-2",
			title: "文章二",
			payload: { postId: "post-2", collectionId: "collection-1" },
		};
		await wrapper.setProps({ layer: nextLayer });
		await flushPromises();
		expect(wrapper.text()).toContain("文章二");

		firstResponse.resolve(response(postDetail("post-1", "文章一")));
		await flushPromises();
		expect(wrapper.text()).toContain("文章二");
		expect(wrapper.text()).not.toContain("文章一");
	});
});
