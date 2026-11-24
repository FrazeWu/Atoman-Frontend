import { afterEach, describe, expect, it, vi } from "vitest";
import { recoverPreviousReleaseAsset } from "../../../functions/_lib/releaseAssetRecovery";

const name = "index-BB_H8XcO.js";
const key = "assets/" + name;
const shardDigest = "ba7d192ed7df4473ef1ba5252a7de6d4e4b932b8f2935079a80ed3df7348f07a";
const oldDeployment = "https://0b0632d9.atoman-frontend.pages.dev";
const hex = (b: ArrayBuffer) => Buffer.from(b).toString("hex");

async function fixture() {
  const script = "export const test = true;";
  const actualDigest = crypto.subtle.digest.bind(crypto.subtle);
  const digest = hex(await actualDigest("SHA-256", new TextEncoder().encode(script)));
  const manifest = JSON.stringify({ [name]: [script.length, digest] });
  // Use a synthetic manifest with a pinned digest; exercise the real
  // SHA-256 calculation for all other data, including corrupted assets.
  vi.spyOn(crypto.subtle, "digest").mockImplementation(async (algorithm, bytes) => {
    const text = new TextDecoder().decode(bytes);
    if (text === manifest) return Uint8Array.from(Buffer.from(shardDigest, "hex")).buffer;
    return actualDigest(algorithm, bytes);
  });
  const get = vi.fn(async (_: string) => ({ body: new Response(manifest).body!, httpEtag: '"manifest"' }));
  const put = vi.fn(async (..._: unknown[]) => ({}));
  const fetcher = vi.fn(async (_: string | Request | URL, __?: RequestInit) =>
    new Response(script, { headers: { "content-type": "application/javascript" } }));
  return { script, manifest, digest, get, put, fetcher };
}

afterEach(() => vi.restoreAllMocks());
describe("pinned historical release asset recovery", () => {
  it("serves only the exact verified file and archives it conditionally", async () => {
    const f = await fixture();
    const jobs: Promise<unknown>[] = [];
    const response = await recoverPreviousReleaseAsset(key, "GET", f, p => jobs.push(p), f.fetcher as typeof fetch);
    expect(response?.status).toBe(200);
    expect(response?.headers.get("x-atoman-release-recovered")).toBe("0b0632d9");
    expect(await response?.text()).toBe(f.script);
    expect(f.fetcher.mock.calls[0][0]).toBe(oldDeployment + "/" + key);
    expect(f.fetcher.mock.calls[0][1]?.redirect).toBe("error");
    await Promise.all(jobs);
    expect(f.put).toHaveBeenCalledTimes(1);
    const args = f.put.mock.calls[0] as [string, ArrayBuffer, {onlyIf: Headers; sha256: string}];
    expect(args[0]).toBe(key);
    expect(args[2].onlyIf.get("if-none-match")).toBe("*");
    expect(args[2].sha256).toBe(f.digest);
  });
  it("returns no-store 503 for a changed file and never archives it", async () => {
    const f = await fixture();
    const bad = vi.fn(async () => new Response(f.script.replace("true", "null")));
    const response = await recoverPreviousReleaseAsset(key, "GET", f, () => {}, bad as typeof fetch, true);
    expect(response?.status).toBe(503);
    expect(response?.headers.get("cache-control")).toBe("no-store");
    expect(response?.headers.get("x-atoman-recovery-stage")).toBe("asset-verify");
    expect(f.put).not.toHaveBeenCalled();
  });
  it("rejects altered manifests, unknown filenames and unsupported methods", async () => {
    const f = await fixture();
    expect(await recoverPreviousReleaseAsset("assets/index-aaaaaaaa.js", "GET", f, undefined, f.fetcher as typeof fetch)).toBeUndefined();
    expect(await recoverPreviousReleaseAsset(key, "POST", f, undefined, f.fetcher as typeof fetch)).toBeUndefined();
    f.get.mockImplementation(async () => ({body: new Response("{}").body!, httpEtag: '"bad"'}));
    const response = await recoverPreviousReleaseAsset(key, "GET", f, undefined, f.fetcher as typeof fetch, true);
    expect(response?.status).toBe(503);
    expect(response?.headers.get("x-atoman-recovery-stage")).toBe("manifest-verify");
    expect(f.fetcher).not.toHaveBeenCalled();
  });
  it("serves verified bytes even if the optional archive write rejects", async () => {
    const f = await fixture();
    f.put.mockRejectedValueOnce(new Error("Archive unavailable"));
    const jobs: Promise<unknown>[] = [];
    const response = await recoverPreviousReleaseAsset(key, "HEAD", f, p => jobs.push(p), f.fetcher as typeof fetch);
    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe("");
    await Promise.all(jobs);
  });
});
