import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import InboxPage from "@/views/feed/InboxPage.vue";
import { useNotificationStore } from "@/stores/notification";
import { useDMStore } from "@/stores/dm";
import type { Notification } from "@/types";

let routeQuery: Record<string, string> = { tab: "mention" };
const routerPush = vi.fn();
const routerReplace = vi.fn();

vi.mock("vue-router", () => ({
  useRoute: () => ({
    query: routeQuery,
    fullPath: `/inbox?tab=${routeQuery.tab || ""}`,
  }),
  useRouter: () => ({
    push: routerPush,
    replace: routerReplace,
  }),
}));

const makeNotification = (overrides: Partial<Notification>): Notification => ({
  id: "notice-1",
  recipient_id: "user-1",
  actor_id: "user-2",
  actor: { username: "alice", display_name: "Alice", email: "alice@example.com" },
  type: "comment_mention",
  category: "mention",
  reason: "提到了你",
  source_type: "comment",
  source_id: "comment-1",
  actor_count: 1,
  meta: {
    title: "在评论中提到了你",
    body: "请看一下这个方案",
  },
  read_at: null,
  created_at: "2026-03-01T10:00:00Z",
  updated_at: "2026-03-01T10:00:00Z",
  ...overrides,
});

describe("InboxPage modern dual-pane stream", () => {
  const stubs = {
    PTab: { props: ["label"], template: "<button>{{ label }}</button>" },
    PButton: {
      props: ["label", "variant", "size", "disabled"],
      emits: ["click"],
      template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot>{{ label }}</slot></button>',
    },
    PEmpty: {
      props: ["title", "description"],
      template: "<div>{{ title }}{{ description }}</div>",
    },
    PTextarea: {
      props: ["placeholder"],
      template: '<textarea :placeholder="placeholder" />',
    },
    PPress: { props: ["label"], template: "<button>{{ label }}</button>" },
    PBadge: { template: "<span><slot /></span>" },
    PAvatar: { props: ["name", "src"], template: '<div class="stub-avatar">{{ name }}</div>' },
  };

  beforeEach(() => {
    routeQuery = { tab: "mention" };
    routerPush.mockReset();
    routerReplace.mockReset();
    setActivePinia(createPinia());
  });

  it("renders modern dual-pane layout with category navigation and main stream pane", async () => {
    const wrapper = mount(InboxPage, { global: { stubs } });
    await flushPromises();

    const shell = wrapper.find(".inbox-shell");
    expect(shell.exists()).toBe(true);
    expect(shell.find(".inbox-category-pane").exists()).toBe(true);
    expect(shell.find(".inbox-main-pane").exists()).toBe(true);
    expect(shell.find(".stream-workspace").exists()).toBe(true);
    // In stream mode, there should be no legacy 3rd column detail card
    expect(shell.find(".inbox-detail").exists()).toBe(false);
  });

  it("filters notification stream between all and unread", async () => {
    const store = useNotificationStore();
    store.notifications = [
      makeNotification({ id: "n-unread", read_at: null }),
      makeNotification({ id: "n-read", read_at: "2026-03-01T12:00:00Z" }),
    ];

    const wrapper = mount(InboxPage, { global: { stubs } });
    await flushPromises();

    // Default "所有" shows both cards
    expect(wrapper.findAll(".stream-card").length).toBe(2);

    // Switch to "仅未读"
    const unreadBtn = wrapper.findAll(".filter-toggle-btn").find((b) => b.text().includes("仅未读"));
    expect(unreadBtn).toBeDefined();
    await unreadBtn!.trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll(".stream-card").length).toBe(1);
    expect(wrapper.find(".stream-card").classes()).toContain("unread");

    // Switch back to "所有"
    const allBtn = wrapper.findAll(".filter-toggle-btn").find((b) => b.text().includes("所有"));
    await allBtn!.trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll(".stream-card").length).toBe(2);
  });

  it("renders clean empty state when there are no notifications in stream", async () => {
    const store = useNotificationStore();
    store.notifications = [];
    store.loading = false;

    const wrapper = mount(InboxPage, { global: { stubs } });
    await flushPromises();

    expect(wrapper.text()).toContain("收件箱暂无通知");
    expect(wrapper.text()).toContain("新收到的互动与动态将显示在这里");
  });

  it("triggers markAllRead from stream toolbar button", async () => {
    const store = useNotificationStore();
    store.unreadCounts.mention = 3;
    store.notifications = [makeNotification({ id: "n1", read_at: null })];
    const markAllSpy = vi.spyOn(store, "markAllRead").mockResolvedValue(undefined);

    const wrapper = mount(InboxPage, { global: { stubs } });
    await flushPromises();

    const markAllBtn = wrapper.find(".toolbar-mark-read-btn");
    expect(markAllBtn.exists()).toBe(true);
    await markAllBtn.trigger("click");

    expect(markAllSpy).toHaveBeenCalledWith("mention");
  });

  it("switches to dm workspace when dm tab is active", async () => {
    routeQuery = { tab: "dm" };
    const dm = useDMStore();
    vi.spyOn(dm, "fetchConversations").mockResolvedValue();
    dm.reconcile({
      mailboxes: [{ type: "user", id: "me", display_name: "Me", unread_count: 0 }],
      conversationsByMailbox: {},
      activeConversationId: "",
      activeMessages: [],
    });

    const wrapper = mount(InboxPage, { global: { stubs } });
    await flushPromises();

    expect(wrapper.find(".stream-workspace").exists()).toBe(false);
    expect(wrapper.find(".dm-workspace").exists()).toBe(true);
    expect(wrapper.find(".dm-workspace-sidebar").exists()).toBe(true);
    expect(wrapper.find(".dm-workspace-main").exists()).toBe(true);
  });

  it("redirects cleanly to /messages preserving query params when tab is dm", async () => {
    routeQuery = { tab: "dm", conversationId: "conv-99", mailbox: "user:me" };
    const dm = useDMStore();
    vi.spyOn(dm, "fetchConversations").mockResolvedValue();

    mount(InboxPage, { global: { stubs } });
    await flushPromises();

    expect(routerReplace).toHaveBeenCalledWith({
      path: "/messages",
      query: {
        conversationId: "conv-99",
        mailbox: "user:me",
      },
    });
  });
});
