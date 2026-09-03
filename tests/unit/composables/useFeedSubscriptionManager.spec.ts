import { ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFeedSubscriptionManager } from "@/composables/feed/useFeedSubscriptionManager";
import { useAuthStore } from "@/stores/auth";
import { useFeedStore } from "@/stores/feed";

const fetchMock = vi.fn();

function response(data: unknown) {
  return new Response(JSON.stringify({ data }), { status: 200 });
}

function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createManager(refreshTimeline = async () => {}) {
  return useFeedSubscriptionManager({
    currentPage: ref(1),
    refreshTimeline,
  });
}

describe("useFeedSubscriptionManager diagnostics", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    const auth = useAuthStore();
    auth.isAuthenticated = true;
    auth.token = "test-token";
    auth.user = { username: "reader", email: "reader@example.test" };
  });

  it("loads diagnostics into local sheet state from the subscription endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      response([
        {
          id: "diagnostic-1",
          feed_source_id: "source-1",
          kind: "rss_fetch_failure",
          error_code: "http_429",
          message: "feed returned HTTP 429",
          attempt_count: 3,
          created_at: "2026-08-27T10:00:00Z",
        },
      ]),
    );
    const manager = createManager();

    await manager.loadSubscriptionDiagnostics("subscription-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/feed/subscriptions/subscription-1/diagnostics",
      expect.objectContaining({
        headers: { Authorization: "Bearer test-token" },
      }),
    );
    expect(manager.subscriptionDiagnostics.value["subscription-1"]).toEqual([
      expect.objectContaining({
        id: "diagnostic-1",
        kind: "rss_fetch_failure",
      }),
    ]);
    expect(manager.loadingSubscriptionDiagnosticIds.value.size).toBe(0);
  });

  it("keeps concurrent diagnostic responses for separate subscriptions", async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      String(input).includes("subscription-1") ? first.promise : second.promise,
    );
    const manager = createManager();

    const firstRequest = manager.loadSubscriptionDiagnostics("subscription-1");
    const secondRequest = manager.loadSubscriptionDiagnostics("subscription-2");
    second.resolve(
      response([
        {
          id: "diagnostic-2",
          feed_source_id: "source-2",
          kind: "rss_fetch_recovered",
          message: "RSS fetch recovered",
          attempt_count: 3,
          created_at: "2026-08-27T10:02:00Z",
        },
      ]),
    );
    await secondRequest;
    first.resolve(
      response([
        {
          id: "diagnostic-1",
          feed_source_id: "source-1",
          kind: "rss_fetch_failure",
          message: "request failed",
          attempt_count: 3,
          created_at: "2026-08-27T10:01:00Z",
        },
      ]),
    );
    await firstRequest;

    expect(
      manager.subscriptionDiagnostics.value["subscription-1"],
    ).toHaveLength(1);
    expect(
      manager.subscriptionDiagnostics.value["subscription-2"],
    ).toHaveLength(1);
    expect(manager.loadingSubscriptionDiagnosticIds.value.size).toBe(0);
  });
});

describe("useFeedSubscriptionManager unified source state", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal("fetch", fetchMock);
    const auth = useAuthStore();
    auth.isAuthenticated = true;
    auth.token = "test-token";
  });

  it("removes a source by feed source id and refreshes every subscription projection", async () => {
    const feedStore = useFeedStore();
    const unsubscribe = vi
      .spyOn(feedStore, "unsubscribeSubscriptionHubSource")
      .mockResolvedValue(true);
    const fetchSubscriptions = vi.spyOn(feedStore, "fetchSubscriptions").mockResolvedValue(true);
    const fetchGroups = vi.spyOn(feedStore, "fetchGroups").mockResolvedValue(true);
    const fetchTree = vi.spyOn(feedStore, "fetchSubscriptionHubTree").mockResolvedValue(true);
    const refreshTimeline = vi.fn().mockResolvedValue(undefined);
    const manager = createManager(refreshTimeline);

    await manager.deleteSubscription("source-1");

    expect(unsubscribe).toHaveBeenCalledWith("source-1");
    expect(fetchSubscriptions).toHaveBeenCalled();
    expect(fetchGroups).toHaveBeenCalled();
    expect(fetchTree).toHaveBeenCalled();
    expect(refreshTimeline).toHaveBeenCalled();
  });
});
