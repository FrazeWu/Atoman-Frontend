import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it } from "vitest";
import PModal from "@/components/ui/PModal.vue";

describe("PModal.vue", () => {
  it("keeps dialog semantics and restores focus in the mobile runtime", async () => {
    document.documentElement.dataset.atomanApp = "mobile";
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();

    const wrapper = mount(PModal, {
      props: { show: false, title: "编辑内容" },
    });
    await wrapper.setProps({ show: true });
    await nextTick();

    const dialog = document.querySelector(".p-modal");
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(dialog?.querySelector("button"));

    await wrapper.setProps({ show: false });
    await nextTick();
    expect(document.activeElement).toBe(trigger);

    wrapper.unmount();
    trigger.remove();
    delete document.documentElement.dataset.atomanApp;
  });

  it("can render above player overlays when explicitly requested", () => {
    const wrapper = mount(PModal, {
      props: { show: true, abovePlayer: true },
    });

    const backdrop = document.querySelector(".p-modal-backdrop");
    expect(backdrop).toBeInstanceOf(HTMLElement);
    expect(backdrop?.classList.contains("p-modal-backdrop--above-player")).toBe(
      true,
    );
    wrapper.unmount();
  });
});
