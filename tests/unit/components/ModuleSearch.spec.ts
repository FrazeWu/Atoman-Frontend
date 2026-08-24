import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ModuleSearch from "@/components/search/ModuleSearch.vue";
import { referenceApi, type ReferenceTarget } from "@/api/references";

const SearchSurfaceStub = {
  props: [
    "query",
    "open",
    "status",
    "placeholder",
    "inputTestId",
    "dropdownTestId",
    "loading",
    "empty",
  ],
  emits: ["update:query", "focus", "blur", "submit"],
  template: `
    <div>
      <input
        :data-testid="inputTestId"
        :value="query"
        :placeholder="placeholder"
        @input="$emit('update:query', $event.target.value)"
        @focus="$emit('focus')"
        @blur="$emit('blur')"
      >
      <span data-testid="status">{{ status }}</span>
      <div v-if="open" :data-testid="dropdownTestId"><slot name="results" /></div>
    </div>
  `,
};

const target = (overrides: Partial<ReferenceTarget> = {}): ReferenceTarget => ({
  type: "video",
  id: "video-1",
  label: "骑行视频",
  module: "video",
  path: "/videos/watch/video-1",
  available: true,
  ...overrides,
});

function mountSearch(modelValue = "") {
  return mount(ModuleSearch, {
    props: {
      modelValue,
      targetTypes: ["video"],
      inputTestId: "module-search-input",
      dropdownTestId: "module-search-dropdown",
    },
    global: {
      stubs: { SearchSurface: SearchSurfaceStub },
    },
  });
}

describe("ModuleSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("在防抖后搜索并过滤不可用结果", async () => {
    vi.spyOn(referenceApi, "search").mockResolvedValue([
      target(),
      target({ id: "video-2", label: "已下架视频", available: false }),
    ]);
    const wrapper = mountSearch("骑行");

    await vi.advanceTimersByTimeAsync(249);
    expect(referenceApi.search).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();

    expect(referenceApi.search).toHaveBeenCalledWith(
      ["video"],
      "骑行",
      12,
      expect.any(AbortSignal),
    );
    expect(wrapper.text()).not.toContain("已下架视频");
    await wrapper.find("input").trigger("focus");
    expect(wrapper.text()).toContain("骑行视频");
  });

  it("丢弃被新查询取代的旧响应并取消旧请求", async () => {
    let resolveFirst!: (value: ReferenceTarget[]) => void;
    let resolveSecond!: (value: ReferenceTarget[]) => void;
    const first = new Promise<ReferenceTarget[]>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<ReferenceTarget[]>((resolve) => {
      resolveSecond = resolve;
    });
    const search = vi
      .spyOn(referenceApi, "search")
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    const wrapper = mountSearch("旧查询");

    await vi.advanceTimersByTimeAsync(250);
    await wrapper.setProps({ modelValue: "新查询" });
    await vi.advanceTimersByTimeAsync(250);

    const firstSignal = search.mock.calls[0]?.[3];
    expect(firstSignal?.aborted).toBe(true);
    resolveFirst([target({ label: "旧结果" })]);
    resolveSecond([target({ label: "新结果" })]);
    await flushPromises();

    await wrapper.find("input").trigger("focus");
    expect(wrapper.text()).toContain("新结果");
    expect(wrapper.text()).not.toContain("旧结果");
  });

  it("展示错误状态并发出选择事件", async () => {
    vi.spyOn(referenceApi, "search").mockRejectedValue(new Error("network"));
    const wrapper = mountSearch("视频");

    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    expect(wrapper.text()).toContain("搜索失败");

    vi.mocked(referenceApi.search).mockResolvedValue([target()]);
    await wrapper.setProps({ modelValue: "新视频" });
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    await wrapper.find("input").trigger("focus");
    await wrapper.find("button").trigger("mousedown");

    expect(wrapper.emitted("select")?.[0]).toEqual([target()]);
  });
});
