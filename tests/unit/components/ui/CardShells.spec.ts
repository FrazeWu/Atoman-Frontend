import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import PIdentityCard from "@/components/ui/PIdentityCard.vue";
import PInteractionCard from "@/components/ui/PInteractionCard.vue";
import PMediaCard from "@/components/ui/PMediaCard.vue";

describe("shared card shells", () => {
  it("provides a keyboard-activatable identity card shell and forwards attributes", async () => {
    const wrapper = mount(PIdentityCard, {
      props: { interactive: true },
      attrs: { "data-test": "identity-card", "aria-label": "打开频道" },
      slots: {
        visual: "<span>V</span>",
        title: "<h3>频道</h3>",
        badge: "<span>频道</span>",
        actions: '<button type="button">订阅</button>',
      },
    });

    const card = wrapper.get('[data-test="identity-card"]');
    expect(card.element.tagName).toBe("ARTICLE");
    expect(card.attributes("role")).toBe("button");
    expect(card.attributes("aria-label")).toBe("打开频道");

    await card.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("activate")).toHaveLength(1);
  });

  it("keeps media variants explicit for square and landscape content", () => {
    const square = mount(PMediaCard, {
      props: { variant: "square" },
      slots: { default: '<div class="cover-frame">专辑</div>' },
    });
    const landscape = mount(PMediaCard, {
      props: { variant: "landscape" },
      slots: { default: '<div class="vc-thumb">视频</div>' },
    });

    expect(square.get(".p-media-card").classes()).toContain(
      "p-media-card--square",
    );
    expect(landscape.get(".p-media-card").classes()).toContain(
      "p-media-card--landscape",
    );
  });

  it("supports flat interaction content without adding a border in the shell", () => {
    const wrapper = mount(PInteractionCard, {
      props: { variant: "flat" },
      slots: { default: "<p>短笺内容</p>" },
    });

    expect(wrapper.get(".p-interaction-card").classes()).toContain(
      "p-interaction-card--flat",
    );
  });
});
