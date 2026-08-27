import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppTopbarGlobalSearch from "@/components/system/AppTopbarGlobalSearch.vue";
import { referenceApi } from "@/api/references";

vi.mock("@/api/references", () => ({
  referenceApi: {
    search: vi.fn(),
  },
}));

describe("AppTopbarGlobalSearch", () => {
  const wrappers: Array<ReturnType<typeof mount>> = [];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  afterEach(() => {
    for (const wrapper of wrappers.splice(0)) wrapper.unmount();
    vi.useRealTimers();
  });

  const mountSearch = async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/feed", component: { template: "<div />" } },
        { path: "/posts/post/:id", component: { template: "<div />" } },
      ],
    });
    await router.push("/feed");
    await router.isReady();
    const wrapper = mount(AppTopbarGlobalSearch, {
      global: { plugins: [router] },
    });
    document.body.appendChild(wrapper.element);
    wrappers.push(wrapper);
    return { wrapper, router };
  };

  it("opens from the topbar and from the global keyboard shortcut", async () => {
    const { wrapper } = await mountSearch();

    await wrapper.find('[data-testid="topbar-search-pill"]').trigger("click");
    expect(
      wrapper.find('[data-testid="topbar-search-dropdown"]').exists(),
    ).toBe(true);

    await wrapper.find(".search-close-btn").trigger("click");
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true }),
    );
    await flushPromises();
    expect(
      wrapper.find('[data-testid="topbar-search-dropdown"]').exists(),
    ).toBe(true);
  });

  it("does not open from slash when the focus target is contenteditable", async () => {
    const { wrapper } = await mountSearch();
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    document.body.appendChild(editable);

    editable.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "/",
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushPromises();

    expect(
      wrapper.find('[data-testid="topbar-search-dropdown"]').exists(),
    ).toBe(false);
  });

  it("debounces input and opens the keyboard-selected result with Enter", async () => {
    vi.mocked(referenceApi.search).mockResolvedValue([
      {
        type: "post",
        id: "first",
        label: "First",
        module: "blog",
        path: "/post/first",
        available: true,
      },
      {
        type: "post",
        id: "second",
        label: "Second",
        module: "blog",
        path: "/post/second",
        available: true,
      },
    ]);
    const { wrapper, router } = await mountSearch();
    await wrapper.find('[data-testid="topbar-search-pill"]').trigger("click");

    const input = wrapper.find('[data-testid="topbar-search-input"]');
    await input.setValue("atom");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    expect(referenceApi.search).toHaveBeenCalledOnce();
    expect(wrapper.findAll(".topbar-search-section__item")).toHaveLength(2);
    await input.trigger("keydown", { key: "ArrowDown" });
    await input.trigger("keydown", { key: "Enter" });
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe("/posts/post/second");
    expect(
      wrapper.find('[data-testid="topbar-search-dropdown"]').exists(),
    ).toBe(false);
  });
  it("traps focus inside the search dialog and restores the trigger focus", async () => {
    const { wrapper } = await mountSearch();
    const trigger = wrapper.get('[data-testid="topbar-search-pill"]')
      .element as HTMLButtonElement;
    trigger.focus();

    await wrapper.get('[data-testid="topbar-search-pill"]').trigger("click");
    await nextTick();
    expect(document.activeElement).toBe(
      wrapper.get('[data-testid="topbar-search-input"]').element,
    );

    const lastFilter = wrapper.findAll(".palette-filter-pill").at(-1);
    expect(lastFilter).toBeDefined();
    lastFilter!.element.focus();
    await wrapper
      .get('[data-testid="topbar-search-dropdown"]')
      .trigger("keydown", { key: "Tab" });
    expect(document.activeElement).toBe(
      wrapper.get('[data-testid="topbar-search-input"]').element,
    );

    await lastFilter!.trigger("keydown", { key: "Escape" });
    await nextTick();
    expect(
      wrapper.find('[data-testid="topbar-search-dropdown"]').exists(),
    ).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });
});
