import { afterEach, expect, it, vi } from "vitest";

import {
  ApiErrorResponseError,
  createApiClient,
} from "../../../packages/api-client/src/index.ts";
import { apiRequestEnvelope } from "../../../src/api/client";

afterEach(() => vi.restoreAllMocks());

it("shares envelope and API error semantics through the package client", async () => {
  const requests: RequestInit[] = [];
  const client = createApiClient(
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(init ?? {});
      return new Response(JSON.stringify({ data: { id: "post-1" } }), {
        status: 200,
      });
    },
  );

  await expect(
    client.apiPostJson<{ id: string }>("/api/v1/posts", { title: "Test" }),
  ).resolves.toEqual({ id: "post-1" });
  expect(requests[0]).toMatchObject({
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
  });

  const failingClient = createApiClient(
    async () =>
      new Response(
        JSON.stringify({
          error: { code: "post.missing", message: "Post not found" },
        }),
        { status: 404 },
      ),
  );
  await expect(
    failingClient.apiRequestJson("/api/v1/posts/missing"),
  ).rejects.toBeInstanceOf(ApiErrorResponseError);
  await expect(
    failingClient.apiRequestJson("/api/v1/posts/missing"),
  ).rejects.toMatchObject({ status: 404, code: "post.missing" });
});

it("forwards an abort signal for JSON POST requests", async () => {
  const requests: RequestInit[] = [];
  const client = createApiClient(
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(init ?? {});
      return new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
      });
    },
  );
  const signal = new AbortController().signal;

  await expect(
    client.apiPostJson<{ ok: boolean }>("/api/v1/uploads", {}, { signal }),
  ).resolves.toEqual({ ok: true });
  expect(requests[0].signal).toBe(signal);
});

it("throws an API error when apiRequestResult receives invalid JSON in a successful response", async () => {
  const client = createApiClient(
    async () =>
      new Response("not-json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );

  await expect(client.apiRequestResult("/api/v1/posts")).rejects.toBeInstanceOf(
    ApiErrorResponseError,
  );
  await expect(client.apiRequestResult("/api/v1/posts")).rejects.toMatchObject({
    status: 200,
    code: "system.invalid_response",
  });
});

it("sends custom request options and returns the response envelope", async () => {
  vi.stubGlobal("fetch", vi.fn());
  const fetchMock = vi.mocked(fetch);
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        data: { liked: true },
        meta: { source: "test" },
      }),
      { status: 200 },
    ),
  );

  const result = await apiRequestEnvelope<
    { liked: boolean },
    { source: string }
  >("/api/v1/likes", {
    method: "POST",
    body: JSON.stringify({ target_id: "one" }),
  });

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/v1/likes",
    expect.objectContaining({ method: "POST" }),
  );
  expect(result.data.liked).toBe(true);
  expect(result.meta?.source).toBe("test");
});
