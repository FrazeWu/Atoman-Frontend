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
});
