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

  it("lands initial focus on the cancel button when danger is true", async () => {
    const wrapper = mount(PConfirm, {
      props: {
        show: true,
        danger: true,
        title: "危险操作",
        message: "确认删除吗？",
      },
    });
    await nextTick();

    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".p-modal-footer button"),
    );
    const cancelButton = buttons.find((btn) => btn.textContent?.includes("取消"));
    expect(cancelButton).toBeDefined();
    expect(document.activeElement).toBe(cancelButton);

    wrapper.unmount();
  });

  it("lands initial focus on the confirm button when danger is false", async () => {
    const wrapper = mount(PConfirm, {
      props: {
        show: true,
        danger: false,
        title: "正常操作",
        message: "确认发布吗？",
      },
    });
    await nextTick();

    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".p-modal-footer button"),
    );
    const confirmButton = buttons.find((btn) => btn.textContent?.includes("确认"));
    expect(confirmButton).toBeDefined();
    expect(document.activeElement).toBe(confirmButton);

    wrapper.unmount();
  });

  it("binds aria-describedby on the modal matching the message element id", async () => {
    const wrapper = mount(PConfirm, {
      props: {
        show: true,
        title: "无障碍确认",
        message: "详细确认说明文本",
      },
    });
    await nextTick();

    const dialog = document.querySelector(".p-modal");
    const messageEl = document.querySelector(".p-confirm__message");
    expect(messageEl?.id).toBeTruthy();
    expect(dialog?.getAttribute("aria-describedby")).toBe(messageEl?.id);

    wrapper.unmount();
  });
});
