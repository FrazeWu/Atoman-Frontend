import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BlogHomeView from "@/views/blog/BlogHomeView.vue";

const mocks = vi.hoisted(() => ({
  routeQuery: {} as Record<string, string>,
}));

vi.mock("vue-router", () => ({
  useRoute: () => ({
    path: "/posts",
    query: mocks.routeQuery,
  }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  RouterLink: { template: "<a><slot /></a>" },
}));

let pinia = createPinia();

describe("BlogHomeView query search", () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    mocks.routeQuery = {};
  });

  it("uses the dedicated search endpoint for route query q", async () => {
    mocks.routeQuery = { q: "atom" };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
      );

    mount(BlogHomeView, {
      global: {
        plugins: [pinia],
        stubs: {
          PAvatar: true,
          PBadge: true,
          PButton: true,
          PClip: true,
          PEmpty: true,
          PContentCard: true,
          PPageHeader: true,
          PSegmentedControl: true,
        },
      },
    });

    await flushPromises();

    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(requestedUrls).toContain(
      "/api/v1/blog/search?q=atom&sort=relevance&page=1&page_size=20",
    );
    expect(
      requestedUrls.some((url) => url.includes("/blog/recommend/posts")),
    ).toBe(false);
    expect(requestedUrls.some((url) => url.includes("/blog/explore"))).toBe(
      false,
    );
  });

  it("passes author, channel, and collection filters to blog search", async () => {
    mocks.routeQuery = {
      q: "atom",
      author_id: "author-1",
      channel_id: "channel-1",
      collection_id: "collection-1",
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
      );

    mount(BlogHomeView, {
      global: {
        plugins: [pinia],
        stubs: {
          PAvatar: true,
          PBadge: true,
          PButton: true,
          PClip: true,
          PEmpty: true,
          PContentCard: true,
          PPageHeader: true,
          PSegmentedControl: true,
        },
      },
    });

    await flushPromises();

    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(requestedUrls).toContain(
      "/api/v1/blog/search?q=atom&author_id=author-1&channel_id=channel-1&collection_id=collection-1&sort=relevance&page=1&page_size=20",
    );
  });
});
