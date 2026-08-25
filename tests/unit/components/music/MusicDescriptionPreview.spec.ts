import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it } from "vitest";
// @ts-expect-error Vitest resolves Vue SFCs through Vite; this test is outside the Vue TS project.
import MusicDescriptionPreview from "../../../../src/components/music/MusicDescriptionPreview.vue";

describe("MusicDescriptionPreview.vue", () => {
  it("shows a three-line preview before expanding overflowing text", async () => {
    const wrapper = mount(MusicDescriptionPreview, {
      props: {
        description:
          "A detailed introduction that exceeds the available preview height.",
        contentId: "test-description",
        testId: "test-description-toggle",
      },
    });
    await nextTick();

    const description = wrapper.get("#test-description").element;
    Object.defineProperties(description, {
      clientHeight: { configurable: true, value: 60 },
      scrollHeight: { configurable: true, value: 120 },
    });
    window.dispatchEvent(new Event("resize"));
    await nextTick();

    const toggle = wrapper.get('[data-testid="test-description-toggle"]');
    expect(description.textContent).toBe(
      "A detailed introduction that exceeds the available preview height.",
    );
    expect(toggle.attributes("aria-expanded")).toBe("false");
    expect(wrapper.get("#test-description").classes()).not.toContain(
      "is-expanded",
    );

    await toggle.trigger("click");
    expect(toggle.attributes("aria-expanded")).toBe("true");
    expect(toggle.text()).toContain("收起");
    expect(wrapper.get("#test-description").classes()).toContain("is-expanded");

    await toggle.trigger("click");
    expect(toggle.attributes("aria-expanded")).toBe("false");
    expect(toggle.text()).toContain("展开");
  });

  it("does not render a collapse control for a short description", async () => {
    const wrapper = mount(MusicDescriptionPreview, {
      props: {
        description: "Short introduction",
        contentId: "short-description",
        testId: "short-description-toggle",
      },
    });
    await nextTick();

    expect(wrapper.get("#short-description").text()).toBe("Short introduction");
    expect(
      wrapper.find('[data-testid="short-description-toggle"]').exists(),
    ).toBe(false);
  });
});
