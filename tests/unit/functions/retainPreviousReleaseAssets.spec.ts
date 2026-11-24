import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { digest, retainAssets, validateManifest } from "../../../scripts/retain-previous-release-assets";

const rootDirs: string[] = [];
const name = "index-abcdefgh.js";
const source = "https://0b0632d9.atoman-frontend.pages.dev";
const bytes = Buffer.from("export const retained = true;");
const manifest = () => validateManifest({
  version: 1, deployment: source,
  assets: { [name]: [bytes.byteLength, digest(bytes)] },
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "atoman-retention-test-"));
  rootDirs.push(root);
  const dir = join(root, "dist"), cache = join(root, "cache");
  await mkdir(dir);
  return { dir, cache };
}
afterEach(async () => {
  await Promise.all(rootDirs.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe("build-time exact public release retention", () => {
  it("recovers original bytes without altering an existing current asset and reuses verified cache", async () => {
    const {dir, cache} = await fixture();
    const request = vi.fn(async () => new Response(bytes, {headers: {"content-type": "application/javascript"}}));
    expect(await retainAssets(dir, cache, [manifest()], request as typeof fetch)).toEqual({retained: 1, unchanged: 0, total: 1});
    expect(await readFile(join(dir, name))).toEqual(bytes);
    expect(request).toHaveBeenCalledTimes(1);
    expect(await retainAssets(dir, cache, [manifest()], request as typeof fetch)).toEqual({retained: 0, unchanged: 1, total: 1});
    await rm(join(dir, name));
    expect(await retainAssets(dir, cache, [manifest()], request as typeof fetch)).toEqual({retained: 1, unchanged: 0, total: 1});
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("rejects different bytes under an immutable filename before overwriting", async () => {
    const {dir, cache} = await fixture();
    await writeFile(join(dir, name), "new release bytes");
    const request = vi.fn();
    await expect(retainAssets(dir, cache, [manifest()], request)).rejects.toThrow("filename collision");
    expect(await readFile(join(dir, name), "utf8")).toBe("new release bytes");
    expect(request).not.toHaveBeenCalled();
  });

  it("does not allow untrusted origins or escaping asset paths", () => {
    for (const deployment of ["https://example.org", source + "/other", source + "@example.org"]) {
      expect(() => validateManifest({...manifest(), deployment})).toThrow();
    }
    expect(() => validateManifest({...manifest(), assets: {"../index-abcdefgh.js": [bytes.length, digest(bytes)]}})).toThrow();
  });

  it("rejects a corrupt or HTML response rather than emitting a broken asset", async () => {
    const {dir, cache} = await fixture();
    const bad = vi.fn(async () => new Response("<html>error</html>", {headers: {"content-type":"text/html"}}));
    await expect(retainAssets(dir, cache, [manifest()], bad as typeof fetch)).rejects.toThrow("retention failed");
    await expect(readFile(join(dir, name))).rejects.toThrow();
  });
});
