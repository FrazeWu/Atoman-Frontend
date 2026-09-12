import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { defineComponent } from "vue";
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

  it("supports an explicit right-side sheet presentation", () => {
    const PSheetStub = defineComponent({
      name: "PSheet",
      props: ["side", "mode", "partialWidth"],
      template: '<section data-testid="confirm-right-sheet" :data-side="side" :data-mode="mode" :data-partial-width="partialWidth"><slot /></section>',
    });
    const wrapper = mount(PConfirm, {
      props: { show: true, side: "right", title: "注销账户", message: "确认注销吗？" },
      global: { stubs: { PSheet: PSheetStub } },
    });

    const sheet = wrapper.findComponent(PSheetStub);
    expect(sheet.props("side")).toBe("right");
    expect(sheet.props("mode")).toBe("partial");
  });

  it("renders an operation error below the confirmation actions", () => {
    const wrapper = mount(PConfirm, {
      props: { show: true, title: "删除内容", message: "确认删除吗？", error: "删除失败，请重试" },
    });

    const alert = document.querySelector<HTMLElement>('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toContain("删除失败，请重试");
    expect(alert!.parentElement?.classList.contains("p-modal-footer")).toBe(true);
  });
});
