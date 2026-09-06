import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

	it("在弹层中切换为带页眉页脚的学术双栏阅读", async () => {
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
				stubs: { PSheet: { template: "<section><slot /></section>" } },
			},
		});
		await flushPromises();

		expect(wrapper.get('[data-test="post-reading-single"]').text()).toBe("单栏");
		expect(wrapper.get('[data-test="post-reading-double"]').text()).toBe("双栏");
		expect(wrapper.get('[role="note"]').text()).toContain("最近更新时间：");
		await wrapper.get('[data-test="post-reading-double"]').trigger("click");

		expect(wrapper.find(".academic-reader").exists()).toBe(true);
		expect(wrapper.get('[role="note"]').text()).toContain("最近更新时间：");
		expect(wrapper.findAll(".academic-paper")).toHaveLength(1);
		expect(wrapper.get(".academic-paper__header").text()).toContain("Atoman");
		expect(wrapper.get(".academic-paper__footer").text()).toMatch(/发布.*第 1 页.*更新/);
		expect(wrapper.find(".academic-paper__body").classes()).toContain("prose-blog-academic");
	});

	it("在详情头部展示作者身份、阅读时长和轻量有效性提示", async () => {
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
				stubs: { PSheet: { template: "<section><slot /></section>" } },
			},
		});
		await flushPromises();

		expect(wrapper.find(".post-sheet-author-avatar").exists()).toBe(true);
		expect(wrapper.get(".post-sheet-author").text()).toContain("author");
		expect(wrapper.get(".post-sheet-author-handle").text()).toBe("@author");
		expect(wrapper.get(".post-sheet-reading-time").text()).toBe("约 1 分钟阅读");
		expect(wrapper.get('[role="note"]').classes()).toContain("post-update-notice--compact");
	});

	it("保留详情头部，并将学术正文限制在 A4 纸张内", async () => {
		const source = readFileSync(
			resolve(__dirname, "../../../../src/components/blog/BlogPostSheet.vue"),
			"utf8",
		);

		expect(source).toContain("aspect-ratio: 210 / 297;");
		expect(source).toContain("width: min(100%, 42rem);");
		expect(source).not.toContain('v-if="index === 0" class="academic-paper__lead"');
	});

	it("学术正文不使用段落首行缩进", () => {
		const source = readFileSync(
			resolve(__dirname, "../../../../src/views/blog/PostDetailView.vue"),
			"utf8",
		);

		expect(source).toContain(".prose-blog-academic :deep(p) {");
		expect(source).toContain("text-indent: 0;");
		expect(source).not.toContain("text-indent: 1.5rem;");
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

	it("clears an existing rating from the sheet", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.includes("/related")) return response([]);
			if (url.endsWith("/rating") && init?.method === "DELETE") {
				return response({ rating_score: 0, rating_count: 0 });
			}
			if (url.includes("/blog/posts/post-1")) {
				return response(postDetail("post-1", "文章一", { viewer_rating: 8 }));
			}
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
						emits: ["clear"],
						template: '<button data-test="clear-rating" @click="$emit(\'clear\')" />',
					},
				},
			},
		});
		await flushPromises();
		await wrapper.get('[data-test="clear-rating"]').trigger("click");
		await flushPromises();

		expect(fetchMock.mock.calls.some(([input, init]) => (
			String(input).endsWith("/rating") && init?.method === "DELETE"
		))).toBe(true);
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
