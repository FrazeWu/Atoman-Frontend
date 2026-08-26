import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PToast from "@/components/ui/PToast.vue";

describe("PToast", () => {
  const renderedToast = () =>
    document.body.querySelector<HTMLElement>(".p-toast");

  beforeEach(() => document.body.replaceChildren());

  afterEach(() => {
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it("renders info toast by default", () => {
    const wrapper = mount(PToast, {
      props: {
        message: "Hello World",
        modelValue: true,
      },
    });
    expect(renderedToast()?.classList).toContain("p-toast--info");
    expect(renderedToast()?.textContent).toContain("Hello World");
    wrapper.unmount();
  });

  it("renders success toast with correct class", () => {
    const wrapper = mount(PToast, {
      props: {
        message: "Success Message",
        type: "success",
        modelValue: true,
      },
    });
    expect(renderedToast()?.classList).toContain("p-toast--success");
    wrapper.unmount();
  });

  it("renders danger toast with correct class", () => {
    const wrapper = mount(PToast, {
      props: {
        message: "Error Message",
        type: "danger",
        modelValue: true,
      },
    });
    expect(renderedToast()?.classList).toContain("p-toast--danger");
    wrapper.unmount();
  });

  it("renders warning toast with correct class", () => {
    const wrapper = mount(PToast, {
      props: {
        message: "需要重试",
        type: "warning",
        modelValue: true,
      },
    });

    expect(renderedToast()?.classList).toContain("p-toast--warning");
    wrapper.unmount();
  });

  it("hides an uncontrolled toast after its duration", async () => {
    vi.useFakeTimers();
    const wrapper = mount(PToast, {
      props: {
        message: "短暂提示",
        duration: 100,
      },
    });

    expect(renderedToast()).not.toBeNull();
    vi.advanceTimersByTime(100);
    await nextTick();
    expect(renderedToast()).toBeNull();
    wrapper.unmount();
  });
});
