import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import PModal from "@/components/ui/PModal.vue";

describe("PModal.vue", () => {
  afterEach(() => {
    document.body.replaceChildren();
    delete document.documentElement.dataset.atomanApp;
  });

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

  it("closes from backdrop click only when closeOnBackdrop is enabled", async () => {
    const onClosableClose = vi.fn();
    const onClosableUpdateShow = vi.fn();
    const closable = mount(PModal, {
      props: {
        show: false,
        title: "编辑内容",
        closeOnBackdrop: true,
        onClose: onClosableClose,
        "onUpdate:show": onClosableUpdateShow,
      },
    });
    await closable.setProps({ show: true });
    await nextTick();
    document.querySelector<HTMLElement>(".p-modal-backdrop")?.click();
    await nextTick();
    expect(onClosableClose).toHaveBeenCalledTimes(1);
    expect(onClosableUpdateShow).toHaveBeenCalledTimes(1);
    expect(onClosableUpdateShow).toHaveBeenCalledWith(false);

    closable.unmount();

    const onLockedClose = vi.fn();
    const onLockedUpdateShow = vi.fn();
    const locked = mount(PModal, {
      props: {
        show: false,
        title: "编辑内容",
        closeOnBackdrop: false,
        onClose: onLockedClose,
        "onUpdate:show": onLockedUpdateShow,
      },
    });
    await locked.setProps({ show: true });
    await nextTick();
    document.querySelector<HTMLElement>(".p-modal-backdrop")?.click();
    await nextTick();
    expect(onLockedClose).not.toHaveBeenCalled();
    expect(onLockedUpdateShow).not.toHaveBeenCalled();
    locked.unmount();
  });

  it("lands smart initial focus on the input rather than close button when modal body has an input", async () => {
    const wrapper = mount(PModal, {
      props: { show: true, title: "表单测试" },
      slots: {
        default: '<input id="test-input" placeholder="请输入" />',
      },
    });
    await nextTick();

    const input = document.getElementById("test-input");
    expect(document.activeElement).toBe(input);
    wrapper.unmount();
  });

  it("prioritizes element with autofocus when modal body has an autofocus element", async () => {
    const wrapper = mount(PModal, {
      props: { show: true, title: "Autofocus测试" },
      slots: {
        default: `
          <input id="first-input" placeholder="First" />
          <input id="autofocus-input" autofocus placeholder="Autofocus" />
        `,
      },
    });
    await nextTick();

    const autofocusInput = document.getElementById("autofocus-input");
    expect(document.activeElement).toBe(autofocusInput);
    wrapper.unmount();
  });

  it("binds aria-labelledby to the title id when title is provided", async () => {
    const wrapper = mount(PModal, {
      props: { show: true, title: "标题无障碍测试" },
    });
    await nextTick();

    const dialog = document.querySelector(".p-modal");
    const titleEl = document.querySelector(".p-modal-title-inline");
    expect(titleEl?.id).toBeTruthy();
    expect(titleEl?.id).toMatch(/^modal-title-/);
    expect(dialog?.getAttribute("aria-labelledby")).toBe(titleEl?.id);
    expect(dialog?.getAttribute("aria-label")).toBeNull();

    wrapper.unmount();
  });

  it("falls back to aria-label when title is omitted", async () => {
    const wrapper = mount(PModal, {
      props: { show: true, ariaLabel: "自定义描述" },
    });
    await nextTick();

    const dialog = document.querySelector(".p-modal");
    expect(dialog?.getAttribute("aria-labelledby")).toBeNull();
    expect(dialog?.getAttribute("aria-label")).toBe("自定义描述");

    wrapper.unmount();
  });

  it("explicitly focuses the close button when initialFocus is 'close-button'", async () => {
    const wrapper = mount(PModal, {
      props: { show: true, title: "关闭按钮优先", initialFocus: "close-button" },
      slots: {
        default: '<input id="body-input" />',
      },
    });
    await nextTick();

    const closeButton = document.querySelector(".p-modal-close-floating");
    expect(document.activeElement).toBe(closeButton);
    wrapper.unmount();
  });

  it("wraps focus from last element to first element on Tab", async () => {
    const wrapper = mount(PModal, {
      props: { show: true, title: "焦点循环测试" },
      slots: {
        default: '<input id="input-1" /><button id="btn-2">Action</button>',
      },
    });
    await nextTick();

    const closeBtn = document.querySelector<HTMLElement>(".p-modal-close-floating");
    const input1 = document.getElementById("input-1");
    const btn2 = document.getElementById("btn-2");
    const dialog = document.querySelector<HTMLElement>(".p-modal");

    // Last element is btn2
    btn2?.focus();
    expect(document.activeElement).toBe(btn2);

    // Press Tab on last element -> wraps to closeBtn
    const tabEvent = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    dialog?.dispatchEvent(tabEvent);
    await nextTick();

    expect(document.activeElement).toBe(closeBtn);

    // Press Shift+Tab on first element -> wraps to btn2
    const shiftTabEvent = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    dialog?.dispatchEvent(shiftTabEvent);
    await nextTick();

    expect(document.activeElement).toBe(btn2);

    wrapper.unmount();
  });
});
