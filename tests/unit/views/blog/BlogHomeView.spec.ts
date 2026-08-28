import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BlogHomeView from "@/views/blog/BlogHomeView.vue";

const routerPush = vi.fn();
const routerReplace = vi.fn().mockResolvedValue(undefined);
const openPost = vi.fn();

vi.mock("@/composables/useBlogSheets", () => ({
  useBlogSheets: () => ({ openPost }),
}));

vi.mock("vue-router", () => ({
  RouterLink: { template: "<a><slot /></a>" },
  useRoute: () => ({ path: "/posts", query: {} }),
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
}));

const segmentedControlStub = {
  props: ["modelValue", "options"],
  template: `
    <div>
      <button
        v-for="option in options"
        :key="option.value"
        class="segmented-option"
        @click="$emit('update:modelValue', option.value); $emit('change', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  `,
};

const entryStub = {
  props: ["title", "summary"],
  template: `
    <article class="p-entry" @click="$emit('click')">
      <h3>{{ title }}</h3>
      <p>{{ summary }}</p>
      <div class="entry-actions" @click.stop><slot name="actions" /></div>
    </article>
  `,
};

const mountBlogHome = () =>
  mount(BlogHomeView, {
    global: {
      stubs: {
        PAvatar: true,
        PBadge: true,
        PButton: { template: "<button><slot /></button>" },
        PEmpty: true,
        PContentCard: entryStub,
        PPageHeader: true,
        PSegmentedControl: segmentedControlStub,
      },
    },
  });

const recommendationResponse = (items: unknown[], hasMore?: boolean) =>
  new Response(
    JSON.stringify({
      data: items,
      ...(hasMore === undefined ? {} : { meta: { has_more: hasMore } }),
    }),
    { status: 200 },
  );

describe("BlogHomeView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    routerPush.mockReset();
    routerReplace.mockReset().mockResolvedValue(undefined);
    openPost.mockReset();
    setActivePinia(createPinia());
  });

  it("renders posts returned by the blog discovery endpoint", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes("/blog/recommend/posts")) {
          return recommendationResponse([
            {
              id: "post-discovery-1",
              title: "Discovery Post",
              summary: "From the blog discovery response",
              created_at: "2026-07-06T00:00:00Z",
              target_path: "/posts/post/post-discovery-1",
            },
          ]);
        }
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      });

    const wrapper = mountBlogHome();
    await flushPromises();

    expect(wrapper.text()).toContain("Discovery Post");
    await wrapper.find(".p-entry").trigger("click");

    expect(openPost).toHaveBeenCalledWith("post-discovery-1", "Discovery Post");
    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(requestedUrls).toContain(
      "/api/v1/blog/recommend/posts?mode=hot&page=1&page_size=20",
    );
  });

  it("preserves recommendation excerpts in the discovery stream", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/blog/recommend/posts")) {
        return recommendationResponse([
          {
            id: "post-with-excerpt",
            title: "文章标题",
            excerpt: "来自推荐接口的文章摘要",
            created_at: "2026-07-06T00:00:00Z",
          },
        ]);
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });

    const wrapper = mountBlogHome();
    await flushPromises();

    expect(wrapper.text()).toContain("来自推荐接口的文章摘要");
  });

  it("keeps the heat recommendation filter without duplicate latest/popular filters", async () => {
    const wrapper = mountBlogHome();
    await flushPromises();

    const options = wrapper
      .findAll(".segmented-option")
      .map((option) => option.text());
    expect(options).toContain("热度");
    expect(options).toContain("精选");
    expect(options).toContain("探索");
    expect(options).not.toContain("最新");
    expect(options).not.toContain("最热");
  });

  it("uses the selected recommendation mode for the main post stream", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes("/blog/recommend/posts")) {
          const featured = url.includes("mode=featured");
          return recommendationResponse([
            {
              id: featured ? "featured-post" : "hot-post",
              title: featured ? "Featured Post" : "Hot Post",
              summary: "Recommendation result",
              created_at: "2026-07-06T00:00:00Z",
            },
          ]);
        }
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      });

    const wrapper = mountBlogHome();
    await flushPromises();
    const featured = wrapper
      .findAll(".segmented-option")
      .find((option) => option.text() === "精选");
    await featured?.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Featured Post");
    expect(routerReplace).toHaveBeenCalledWith({
      path: "/posts",
      query: { mode: "featured" },
    });
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toContain(
      "/api/v1/blog/recommend/posts?mode=featured&page=1&page_size=20",
    );
  });

  it("hides recommendation modes when the short-note filter is active", async () => {
    const wrapper = mountBlogHome();
    await flushPromises();

    const note = wrapper
      .findAll(".segmented-option")
      .find((option) => option.text() === "短笺");
    await note?.trigger("click");
    await flushPromises();

    const options = wrapper
      .findAll(".segmented-option")
      .map((option) => option.text());
    expect(options).toContain("短笺");
    expect(options).not.toContain("热度");
    expect(options).not.toContain("精选");
    expect(options).not.toContain("探索");
    expect(routerReplace).toHaveBeenCalledWith({
      path: "/posts",
      query: { type: "note" },
    });
  });

  it("keeps load-more visible when discovery returns the requested limit", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/blog/recommend/posts")) {
        return recommendationResponse(
          Array.from({ length: 20 }, (_, index) => ({
            id: `post-${index + 1}`,
            title: `Post ${index + 1}`,
            summary: "Discovery post",
            created_at: "2026-07-06T00:00:00Z",
          })),
        );
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });

    const wrapper = mountBlogHome();
    await flushPromises();

    expect(wrapper.text()).toContain("加载更多");
  });
});
