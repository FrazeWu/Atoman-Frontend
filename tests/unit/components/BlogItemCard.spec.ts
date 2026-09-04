import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

// @ts-expect-error Vue SFC resolution is provided by vue-tsc and Vitest.
import BlogItemCard from "../../../src/components/shared/BlogItemCard.vue";

const entryStub = {
  props: ["summary"],
  template:
    '<article><slot name="visual" /><p data-test="summary">{{ summary }}</p><slot name="meta" /><slot name="actions" /></article>',
};

const post = {
  id: "post-1",
  title: "Markdown article",
  content:
    "# Heading\nA **readable** [summary](https://example.com) for the article.",
  status: "published" as const,
  visibility: "public" as const,
  pinned: false,
  created_at: "2026-08-25T00:00:00Z",
  updated_at: "2026-08-25T00:00:00Z",
};

describe("BlogItemCard", () => {
  it("uses the explicit summary when it is available", () => {
    const wrapper = mount(BlogItemCard, {
      props: { item: { ...post, summary: "Curated summary" }, type: "post" },
      global: { stubs: { PContentCard: entryStub } },
    });

    expect(wrapper.get('[data-test="summary"]').text()).toBe("Curated summary");
  });

  it("starts at a Markdown summary section instead of leading document metadata", () => {
    const wrapper = mount(BlogItemCard, {
      props: {
        item: {
          ...post,
          content:
            "- Author: Atoman\n- Date: 2026-08-24\n- Version: V2\n\n## 摘要\n\nThis is the article summary readers should scan first.",
        },
        type: "post",
      },
      global: { stubs: { PContentCard: entryStub } },
    });

    expect(wrapper.get('[data-test="summary"]').text()).toBe(
      "This is the article summary readers should scan first.",
    );
  });

  it("derives a readable summary from Markdown content when summary is absent", () => {
    const wrapper = mount(BlogItemCard, {
      props: { item: post, type: "post" },
      global: { stubs: { PContentCard: entryStub } },
    });

    expect(wrapper.get('[data-test="summary"]').text()).toBe(
      "Heading A readable summary for the article.",
    );
  });

  it("uses the feed item image when an RSS source has no cover", () => {
    const wrapper = mount(BlogItemCard, {
      props: {
        item: {
          id: "feed-image-1",
          title: "RSS article",
          summary: "A summary",
          image_url: "https://example.com/article-image.png",
          feed_source: { id: "source-1", title: "RSS source", source_type: "external_rss" },
        },
        type: "feed_item",
      },
      global: {
        stubs: {
          PContentCard: entryStub,
          PAvatar: {
            props: ["src"],
            template: '<span data-test="avatar" :data-src="src" />',
          },
        },
      },
    });

    expect(wrapper.get('[data-test="avatar"]').attributes("data-src")).toBe(
      "https://example.com/article-image.png",
    );
  });

  it("uses an interactive custom source title for subscription items", async () => {
    const wrapper = mount(BlogItemCard, {
      props: {
        item: {
          id: "feed-1",
          title: "A subscribed article",
          summary: "A summary",
          published_at: "2026-08-25T00:00:00Z",
          feed_source: { id: "source-1", title: "Raw source title", source_type: "external_rss" },
        },
        type: "feed_item",
        sourceTitle: "我的订阅名称",
        sourceInteractive: true,
      },
      global: { stubs: { PContentCard: entryStub } },
    });

    expect(wrapper.get('[data-test="feed-source-trigger"]').text()).toBe("我的订阅名称");
    await wrapper.get('[data-test="feed-source-trigger"]').trigger("click");
    expect(wrapper.emitted("open-source")).toHaveLength(1);
  });

  it("hides public rating statistics until five people have rated", () => {
    const insufficient = mount(BlogItemCard, {
      props: { item: { ...post, rating_score: 10, rating_count: 4 }, type: "post" },
      global: { stubs: { PContentCard: entryStub } },
    });
    const publicRating = mount(BlogItemCard, {
      props: { item: { ...post, rating_score: 8.6, rating_count: 5 }, type: "post" },
      global: { stubs: { PContentCard: entryStub } },
    });

    expect(insufficient.text()).not.toContain("10.0 / 10");
    expect(publicRating.text()).toContain("8.6 / 10 · 5 人");
  });
});
