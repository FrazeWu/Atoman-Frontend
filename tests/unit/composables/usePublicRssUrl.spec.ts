import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useApi } from "@/composables/useApi";

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public RSS URLs", () => {
  it("uses absolute URLs when the frontend proxies the API", () => {
    const api = useApi();

    expect(api.rss.user("alice smith")).toBe(
      `${window.location.origin}/api/v1/rss/users/alice%20smith.xml`,
    );
    expect(api.rss.channel("creator/channel")).toBe(
      `${window.location.origin}/api/v1/rss/channels/creator%2Fchannel.xml`,
    );
    expect(api.rss.collection("collection-1")).toBe(
      `${window.location.origin}/api/v1/rss/collections/collection-1.xml`,
    );
  });

  it("preserves an explicitly configured API origin", () => {
    vi.stubEnv("VITE_API_URL", "https://api.atoman.org/api");
    const api = useApi();

    expect(api.rss.user("alice")).toBe(
      "https://api.atoman.org/api/v1/rss/users/alice.xml",
    );
  });
});
