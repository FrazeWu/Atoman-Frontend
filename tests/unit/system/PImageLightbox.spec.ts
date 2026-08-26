import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import PImageLightbox from "@/components/ui/PImageLightbox.vue";

describe("PImageLightbox.vue", () => {
  afterEach(() => document.body.replaceChildren());

  it("focuses the preview, supports keyboard navigation, and restores focus", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();

    const wrapper = mount(PImageLightbox, {
      props: { show: false, images: ["/first.jpg", "/second.jpg"] },
    });
    await wrapper.setProps({ show: true });
    await nextTick();

    const backdrop = document.querySelector<HTMLElement>(
      ".p-lightbox-backdrop",
    );
    expect(backdrop).toBeInstanceOf(HTMLElement);
    expect(document.activeElement).toBe(
      document.querySelector(".p-lightbox-close"),
    );

    backdrop?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await nextTick();
    expect(
      document.querySelector(".p-lightbox-counter")?.textContent?.trim(),
    ).toBe("2 / 2");

    await wrapper.setProps({ show: false });
    await nextTick();
    expect(document.activeElement).toBe(trigger);

    wrapper.unmount();
    trigger.remove();
  });
});
