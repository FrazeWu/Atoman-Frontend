import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppTopbarGlobalSearch from "@/components/system/AppTopbarGlobalSearch.vue";
import { searchApi } from "@/api/search";

vi.mock("@/api/search", () => ({
  searchApi: {
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

    const trigger = wrapper.get('[data-testid="topbar-search-pill"]')
    expect(trigger.attributes('aria-label')).toBeUndefined()
    expect(trigger.text().replace(/\s/g, '')).toBe('搜索...CtrlK')

    await trigger.trigger("click");
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
    vi.mocked(searchApi.search).mockResolvedValue({
      view: "preview", scope: "public", query: "atom", partial: false, items: [],
      groups: [{
        module: "blog", type: "post", label: "文章", total: 2, has_more: false, error: null,
        items: [
          { key: "post:first", type: "post", id: "first", title: "First", module: "blog", href: "/posts/post/first" },
          { key: "post:second", type: "post", id: "second", title: "Second", module: "blog", href: "/posts/post/second" },
        ],
      }],
    });
    const { wrapper, router } = await mountSearch();
    await wrapper.find('[data-testid="topbar-search-pill"]').trigger("click");

    const input = wrapper.find('[data-testid="topbar-search-input"]');
    await input.setValue("atom");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    await vi.dynamicImportSettled();
    await nextTick();

    expect(searchApi.search).toHaveBeenCalledOnce();
    expect(wrapper.findAll(".topbar-search-section__item")).toHaveLength(2);
    await input.trigger("keydown", { key: "ArrowDown" });
    await input.trigger("keydown", { key: "Enter" });
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe("/posts/post/second");
    expect(
      wrapper.find('[data-testid="topbar-search-dropdown"]').exists(),
    ).toBe(false);
  });
  it("reissues a backend-scoped preview when switching from all to users and music", async () => {
    vi.mocked(searchApi.search).mockResolvedValue({
      view: "preview", scope: "public", query: "cols", partial: false, items: [], groups: [],
    });
    const { wrapper } = await mountSearch();
    await wrapper.get('[data-testid="topbar-search-pill"]').trigger("click");
    await wrapper.get('[data-testid="topbar-search-input"]').setValue("cols");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    expect(searchApi.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: "cols", module: "" }), expect.any(AbortSignal), true,
    );

    const userTab = wrapper.findAll(".palette-filter-pill").find(tab => tab.text().trim() === "用户");
    expect(userTab).toBeDefined();
    await userTab!.trigger("click");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    expect(searchApi.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: "cols", module: "users" }), expect.any(AbortSignal), true,
    );

    const musicTab = wrapper.findAll(".palette-filter-pill").find(tab => tab.text().trim() === "音乐");
    expect(musicTab).toBeDefined();
    await musicTab!.trigger("click");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    expect(searchApi.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: "cols", module: "music" }), expect.any(AbortSignal), true,
    );
  });

  it("does not label partially failed search categories as no matches", async () => {
    vi.mocked(searchApi.search).mockResolvedValue({
      view: "preview", scope: "public", query: "cols", partial: true, items: [], groups: [],
    });
    const { wrapper } = await mountSearch();
    await wrapper.get('[data-testid="topbar-search-pill"]').trigger("click");
    await wrapper.get('[data-testid="topbar-search-input"]').setValue("cols");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    expect(wrapper.text()).toContain("部分搜索类别暂不可用");
    expect(wrapper.text()).not.toContain("未找到与“cols”相关的内容");
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
