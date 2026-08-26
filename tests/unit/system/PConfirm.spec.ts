import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import PConfirm from "@/components/ui/PConfirm.vue";

describe("PConfirm.vue", () => {
  afterEach(() => {
    document.body.replaceChildren();
    delete document.documentElement.dataset.atomanApp;
  });

  it("renders as a modal on mobile and emits cancel once", async () => {
    document.documentElement.dataset.atomanApp = "mobile";
    const wrapper = mount(PConfirm, {
      props: { show: true, title: "删除内容", message: "确认删除吗？" },
    });

    const dialog = document.querySelector(".p-modal");
    expect(dialog?.getAttribute("role")).toBe("alertdialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.textContent).toContain("确认删除吗？");

    const closeButton = document.querySelector<HTMLButtonElement>(
      ".p-modal-close-floating",
    );
    closeButton?.click();
    await nextTick();

    expect(wrapper.emitted("cancel")).toHaveLength(1);
    wrapper.unmount();
  });
});
