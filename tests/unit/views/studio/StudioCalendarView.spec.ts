import { flushPromises, mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { createMemoryHistory, createRouter } from "vue-router";
import { describe, expect, it, vi } from "vitest";

import StudioCalendarView from "@/views/studio/StudioCalendarView.vue";
import { useStudioStore } from "@/stores/studio";

const RouterLink = { props: ["to"], template: '<a :href="to"><slot /></a>' };

describe("StudioCalendarView", () => {
  it("loads the browser-month range and links scheduled content to its editor", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/studio/manage/calendar", component: { template: "<div />" } },
      ],
    });
    await router.push("/studio/manage/calendar");
    await router.isReady();
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true });
    const store = useStudioStore(pinia);
    const scheduledAt = new Date();
    scheduledAt.setDate(15);
    scheduledAt.setHours(10, 30, 0, 0);
    store.loaded = true;
    store.currentChannel = {
      id: "channel-1",
      name: "主频道",
      slug: "main",
      description: "",
      cover_url: "",
    };
    store.calendarItems = [
      {
        content_id: "content-1",
        id: "post-1",
        module: "blog",
        title: "定时文章",
        scheduled_at: scheduledAt.toISOString(),
        preflight: [{ code: "missing_cover" }],
      },
    ];

    const wrapper = mount(StudioCalendarView, {
      global: { plugins: [pinia, router], stubs: { RouterLink } },
    });
    await flushPromises();

    expect(store.loadCalendar).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
    );
    expect(wrapper.text()).toContain("定时文章");
    expect(wrapper.text()).toContain("缺少封面");
    expect(wrapper.find('a[href="/studio/blog/post-1/edit"]').exists()).toBe(
      true,
    );

    await wrapper.get('[aria-label="下个月"]').trigger("click");
    expect(store.loadCalendar).toHaveBeenCalledTimes(2);
  });

  it("shows the channel empty state instead of an indefinite loading state", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/studio/manage/calendar", component: { template: "<div />" } },
      ],
    });
    await router.push("/studio/manage/calendar");
    await router.isReady();
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true });
    const store = useStudioStore(pinia);
    store.loaded = true;
    store.currentChannel = null;

    const wrapper = mount(StudioCalendarView, {
      global: { plugins: [pinia, router], stubs: { RouterLink } },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("请先创建频道");
    expect(wrapper.text()).not.toContain("加载中...");
    expect(store.loadCalendar).not.toHaveBeenCalled();
  });
});
