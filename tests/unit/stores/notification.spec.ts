import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../../src/stores/auth";
import {
  commentNotificationLocation,
  contentPublishedLocation,
  forumNotificationLocation,
  isCommentNotification,
  useNotificationStore,
} from "../../../src/stores/notification";
import type { Notification, NotificationCategory } from "../../../src/types";

const makeNotification = (
  id: string,
  category: NotificationCategory,
  read_at: string | null = null,
  type = `content.${category}`,
): Notification => ({
  id,
  recipient_id: "user-1",
  actor_id: null,
  actor: null,
  type,
  category,
  reason: "",
  source_type: category,
  source_id: `${id}-source`,
  actor_count: 1,
  meta: {},
  read_at,
  created_at: "2026-06-30T00:00:00.000Z",
  updated_at: "2026-06-30T00:00:00.000Z",
});

describe("notification store", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setActivePinia(createPinia());

    const auth = useAuthStore();
    auth.token = "token";
  });

  it("updates the unified dm unread count without changing other categories", () => {
    const store = useNotificationStore();
    store.unreadCounts.like = 2;

    store.setDMUnread(5);

    expect(store.unreadCounts.dm).toBe(5);
    expect(store.unreadCount).toBe(7);
  });

  it("keeps unread from other notification types when marking one type read", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    const store = useNotificationStore();
    store.unreadCounts.reply = 2;
    store.unreadCounts.like = 3;
    store.notifications = [
      makeNotification("reply-1", "reply"),
      makeNotification("reply-2", "reply"),
      makeNotification("reply-read", "reply", "2026-06-29T00:00:00.000Z"),
    ];

    await store.markAllRead("reply");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/notifications/read-all?category=reply",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(store.unreadCount).toBe(3);
    expect(
      store.notifications.every((item: Notification) => item.read_at),
    ).toBe(true);
  });

  it("does not apply a stale mark-all response after reset", async () => {
    let resolve!: (response: Response) => void;
    vi.spyOn(globalThis, "fetch").mockReturnValue(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    const store = useNotificationStore();
    store.unreadCounts.reply = 1;
    store.notifications = [makeNotification("reply-1", "reply")];
    const pending = store.markAllRead("reply");
    store.resetStore();
    store.unreadCounts.reply = 4;
    resolve(new Response(null, { status: 200 }));
    await pending;
    expect(store.unreadCounts.reply).toBe(4);
    expect(store.notifications).toEqual([]);
  });

  it("replaces unread counts from the categorized API contract", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            data: { total: 4, items: { like: 2, reply: 1, dm: 1 } },
          }),
          { status: 200 },
        ),
    );
    const store = useNotificationStore();
    store.unreadCounts.mention = 7;
    await store.fetchUnreadCounts();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/notifications/unread-counts",
      expect.anything(),
    );
    expect(store.unreadCounts.like).toBe(2);
    expect(store.unreadCounts.mention).toBe(0);
    expect(store.unreadCounts.dm).toBe(1);
    expect(store.unreadCount).toBe(4);
  });

  it("accepts forum follow notifications", () => {
    expect(
      makeNotification("follow-1", "reply", null, "forum_follow").type,
    ).toBe("forum_follow");
  });

  it("locates published content notifications and rejects external meta paths", () => {
    const published = {
      ...makeNotification("published-1", "system", null, "content_published"),
      meta: { path: "/videos/watch/video-1" },
    };
    expect(contentPublishedLocation(published)).toEqual({
      path: "/videos/watch/video-1",
      query: { source: "notification" },
    });
    expect(
      contentPublishedLocation({
        ...published,
        meta: { path: "https://evil.example" },
      }),
    ).toBeNull();
  });

  it("locates video comment notifications without duplicating the module prefix", () => {
    const comment = {
      ...makeNotification("video-comment", "reply", null, "video_comment"),
      meta: {
        target_kind: "video" as const,
        resource_id: "video-1",
        comment_id: "child-1",
        root_id: "root-1",
      },
    };

    expect(commentNotificationLocation(comment)).toEqual({
      path: "/videos/watch/video-1",
      query: { comment_id: "child-1" },
      hash: "#comment-root-1",
    });
  });

  it("treats forum topic comments as comment notifications and locates forum follows", () => {
    const comment = {
      ...makeNotification(
        "forum-comment",
        "reply",
        null,
        "forum_topic_comment",
      ),
      meta: {
        target_kind: "forum_topic" as const,
        resource_id: "topic-1",
        comment_id: "child-1",
        root_id: "root-1",
      },
    };
    expect(isCommentNotification(comment)).toBe(true);
    expect(commentNotificationLocation(comment)).toEqual({
      path: "/forum/topic/topic-1",
      query: { comment_id: "child-1" },
      hash: "#comment-root-1",
    });
    expect(
      forumNotificationLocation({
        ...makeNotification("follow", "reply", null, "forum_follow"),
        meta: { topic_id: "topic-2", topic_title: "Topic" },
      }),
    ).toEqual({ path: "/forum/topic/topic-2" });
  });

  it("inserts realtime forum notifications in the selected forum tab", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [], meta: { total: 0 } }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [], meta: { total: 0 } }), {
          status: 200,
        }),
      );
    const store = useNotificationStore();
    await store.fetchNotifications(["forum_topic_comment", "forum_follow"], 1);

    store.receiveNotification(
      makeNotification("live-forum", "reply", null, "forum_topic_comment"),
    );

    expect(store.notifications.map(({ id }: Notification) => id)).toEqual([
      "live-forum",
    ]);
    expect(store.unreadCount).toBe(1);
  });

  it("uses category when fetching a notification category", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ data: [], meta: { total: 0 } }), {
            status: 200,
          }),
      );
    const store = useNotificationStore();

    await store.fetchNotifications("system");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/notifications?page=1&category=system",
      expect.anything(),
    );
  });

  it("keeps the newest category request state when an earlier response arrives first", async () => {
    let resolveFirst!: (response: Response) => void;
    let resolveSecond!: (response: Response) => void;
    vi.spyOn(globalThis, "fetch")
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveSecond = resolve;
        }),
      );
    const store = useNotificationStore();

    const first = store.fetchNotifications("like", 2);
    const second = store.fetchNotifications("system", 1);

    resolveFirst(
      new Response(
        JSON.stringify({
          data: [makeNotification("like-1", "like")],
          meta: { total: 1 },
        }),
        { status: 200 },
      ),
    );
    await first;

    expect(store.notifications).toEqual([]);
    expect(store.total).toBe(0);
    expect(store.loading).toBe(true);
    expect(store.currentCategory).toBe("system");
    expect(store.currentType).toBe("system");
    expect(store.page).toBe(1);

    resolveSecond(
      new Response(
        JSON.stringify({
          data: [makeNotification("system-1", "system")],
          meta: { total: 3 },
        }),
        { status: 200 },
      ),
    );
    await second;

    expect(store.notifications.map(({ id }: Notification) => id)).toEqual([
      "system-1",
    ]);
    expect(store.total).toBe(3);
    expect(store.loading).toBe(false);
  });

  it("keeps the newest category request state when it completes before an earlier response", async () => {
    let resolveFirst!: (response: Response) => void;
    let resolveSecond!: (response: Response) => void;
    vi.spyOn(globalThis, "fetch")
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveSecond = resolve;
        }),
      );
    const store = useNotificationStore();

    const first = store.fetchNotifications("like", 2);
    const second = store.fetchNotifications("system", 1);

    resolveSecond(
      new Response(
        JSON.stringify({
          data: [makeNotification("system-1", "system")],
          meta: { total: 3 },
        }),
        { status: 200 },
      ),
    );
    await second;

    expect(store.notifications.map(({ id }: Notification) => id)).toEqual([
      "system-1",
    ]);
    expect(store.total).toBe(3);
    expect(store.currentCategory).toBe("system");
    expect(store.currentType).toBe("system");
    expect(store.page).toBe(1);
    expect(store.loading).toBe(false);

    resolveFirst(
      new Response(
        JSON.stringify({
          data: [makeNotification("like-1", "like")],
          meta: { total: 1 },
        }),
        { status: 200 },
      ),
    );
    await first;

    expect(store.notifications.map(({ id }: Notification) => id)).toEqual([
      "system-1",
    ]);
    expect(store.total).toBe(3);
    expect(store.currentCategory).toBe("system");
    expect(store.currentType).toBe("system");
    expect(store.page).toBe(1);
    expect(store.loading).toBe(false);
  });

  it("marks both forum notification types read", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    const store = useNotificationStore();
    store.notifications = [
      makeNotification("topic-comment", "reply", null, "forum_topic_comment"),
      makeNotification("new-topic", "reply", null, "forum_follow"),
    ];

    await store.markAllRead(["forum_topic_comment", "forum_follow"]);

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining("type=forum_topic_comment"),
      expect.stringContaining("type=forum_follow"),
    ]);
    expect(
      store.notifications.every(({ read_at }: Notification) =>
        Boolean(read_at),
      ),
    ).toBe(true);
  });

  it("clears forum realtime filters when resetting the store", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [], meta: { total: 0 } }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [], meta: { total: 0 } }), {
          status: 200,
        }),
      );
    const store = useNotificationStore();
    await store.fetchNotifications(["forum_topic_comment", "forum_follow"], 1);

    store.resetStore();
    store.receiveNotification(
      makeNotification("next-mention", "mention", null, "comment_mention"),
    );

    expect(store.notifications.map(({ id }: Notification) => id)).toEqual([
      "next-mention",
    ]);
  });

  it("saves notification preferences and mutes through registered endpoints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            data: { items: {} },
          }),
          { status: 200 },
        ),
    );
    const store = useNotificationStore();
    store.notifications = [
      makeNotification("like-1", "like", null, "comment_like"),
    ];
    store.total = 10;

    await expect(
      store.savePreference("like", "comment_like", false),
    ).resolves.toBe(true);
    await expect(
      store.createMute("like", "like-1-source", "reason"),
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/notifications/preferences",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/notifications/mutes",
      expect.objectContaining({ method: "POST" }),
    );
    expect(store.notifications).toEqual([]);
    expect(store.total).toBe(9);
  });
});
