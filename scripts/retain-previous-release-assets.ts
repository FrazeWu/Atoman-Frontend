// Keep the immediately preceding public Vite release available as actual
// static files. Runs after Vite, before Pages uploads dist. No runtime cross-
// deployment fetch, API credentials, or database changes are needed.
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

type AssetEntry = [number, string];
type Release = { version: 1; deployment: string; assets: Record<string, AssetEntry> };
const publicSite = "https://www.atoman.org";
const previousSite = "https://0b0632d9.atoman-frontend.pages.dev";
const manifestPath = "/.well-known/atoman-release-assets.json";
const hashedName = /^[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8,}\.(?:js|mjs|css|json|wasm|woff2?|ttf|otf|png|jpe?g|svg|webp|avif|gif|ico)$/;
const maxFile = 16 * 1024 * 1024;
const maxManifest = 512 * 1024;
const maxFiles = 3000;
const maxTotal = 96 * 1024 * 1024;
const pinnedDigests = [
  "d0507751a9424241d7cf8e75a49454d6c34126d281af76488ffd6c67cab7b70f",
  "ba7d192ed7df4473ef1ba5252a7de6d4e4b932b8f2935079a80ed3df7348f07a",
  "d39e195ecfad41ea1967753c27e188026365a218d8ba5c687bc5a5d236fa61b6",
  "5efce07069b7daad960eec5f5f4a65d9d6db85180ac7c8895b503439ffbc19b4",
  "e526319d92fbda8250e1309d6584d67dc9114c7ba5583389f07c0a6d81d0ec99",
  "7bb6308b530c49d92ebb69f21d4ed2e48086215076d8e5830069aca48fcd0c15",
  "660f89959597ab3d14374e0cf6037eae7b61f584a3c85b780f70292676c1d2ca",
  "8bbb8528c63382e93e50a4d20df9ed624ce8834dd7f1d526f516eb3483f203f7",
];

export const digest = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const validDeployment = (s: string) =>
  s === publicSite || /^https:\/\/[a-f0-9]{8}\.atoman-frontend\.pages\.dev$/.test(s);

export function validateManifest(value: unknown): Release {
  if (!value || typeof value !== "object") throw new Error("Invalid release manifest");
  const m = value as Release;
  if (m.version !== 1 || typeof m.deployment !== "string" || !validDeployment(m.deployment) ||
      !m.assets || typeof m.assets !== "object" || Array.isArray(m.assets)) {
    throw new Error("Invalid release manifest or deployment");
  }
  const entries = Object.entries(m.assets);
  let total = 0;
  if (!entries.length || entries.length > maxFiles) throw new Error("Unexpected release file count");
  for (const [name, row] of entries) {
    if (!hashedName.test(name) || !Array.isArray(row) || row.length !== 2 ||
        !Number.isInteger(row[0]) || row[0] <= 0 || row[0] > maxFile ||
        typeof row[1] !== "string" || !/^[a-f0-9]{64}$/.test(row[1])) {
      throw new Error("Invalid release asset entry");
    }
    total += row[0];
  }
  if (total > maxTotal) throw new Error("Release manifest exceeds retention limit");
  return { version: 1, deployment: m.deployment, assets: Object.fromEntries(entries) };
}

async function fileOrMissing(path: string): Promise<Buffer | undefined> {
  try { return await readFile(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
}
function exact(bytes: Uint8Array, entry: AssetEntry) {
  return bytes.byteLength === entry[0] && digest(bytes) === entry[1];
}
async function boundedBody(res: Response, max: number): Promise<Buffer> {
  if (!res.body) throw new Error("Missing response body");
  const reader = res.body.getReader();
  const pieces: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > max) { await reader.cancel(); throw new Error("Release response exceeds limit"); }
      pieces.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(pieces, length);
}

export async function retainAssets(
  distAssets: string, cache: string, releases: Release[], fetcher: typeof fetch = (url, init) => fetch(url, init),
) {
  const wanted = new Map<string, {entry: AssetEntry; source: string}>();
  for (const release of releases.map(validateManifest)) {
    for (const [name, entry] of Object.entries(release.assets)) {
      const old = wanted.get(name);
      if (old && (old.entry[0] !== entry[0] || old.entry[1] !== entry[1])) {
        throw new Error("Conflicting immutable release asset: " + name);
      }
      wanted.set(name, {entry, source: release.deployment});
    }
  }
  if (wanted.size > maxFiles || [...wanted.values()].reduce((n, v) => n + v.entry[0], 0) > maxTotal) {
    throw new Error("Combined release retention exceeds limit");
  }
  await mkdir(cache, {recursive: true});
  const entries = [...wanted];
  let offset = 0, retained = 0, unchanged = 0;
  const failures: string[] = [];
  async function worker() {
    for (;;) {
      const i = offset++;
      if (i >= entries.length) return;
      const [name, {entry, source}] = entries[i];
      try {
        const destination = join(distAssets, name);
        const existing = await fileOrMissing(destination);
        if (existing) {
          if (!exact(existing, entry)) throw new Error("Current release filename collision");
          unchanged++;
          continue;
        }
        const cachedFile = join(cache, entry[1] + "-" + name);
        let bytes = await fileOrMissing(cachedFile);
        if (!bytes || !exact(bytes, entry)) {
          bytes = undefined;
          let last: unknown;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const response = await fetcher(source + "/assets/" + name, {
                redirect: "error", signal: AbortSignal.timeout(15000),
                headers: { "accept-encoding": "identity" },
              });
              if (!response.ok || (response.headers.get("content-type") || "").includes("text/html")) {
                await response.body?.cancel();
                throw new Error("HTTP " + response.status);
              }
              const body = await boundedBody(response, entry[0]);
              if (!exact(body, entry)) throw new Error("Asset hash or size mismatch");
              bytes = body;
              break;
            } catch (error) {
              last = error;
              if (attempt < 2) await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
            }
          }
          if (!bytes) throw last;
          await writeFile(cachedFile, bytes);
        }
        await writeFile(destination, bytes, {flag: "wx"});
        retained++;
      } catch (e) {
        failures.push(name + ": " + (e instanceof Error ? e.message : String(e)));
      }
    }
  }
  await Promise.all(Array.from({length: 8}, worker));
  if (failures.length) throw new Error("Release retention failed (" + failures.length + "): " + failures.slice(0, 12).join("; "));
  return { retained, unchanged, total: wanted.size };
}

async function captureFreshAssets(dir: string): Promise<Record<string, AssetEntry>> {
  const entries: Array<[string, AssetEntry]> = [];
  for (const file of await readdir(dir, {withFileTypes: true})) {
    if (!file.isFile() || !hashedName.test(file.name)) continue;
    const bytes = await readFile(join(dir, file.name));
    entries.push([file.name, [bytes.byteLength, digest(bytes)]]);
  }
  entries.sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
}
async function bootstrapRelease(): Promise<Release> {
  const assets: Record<string, AssetEntry> = {};
  for (let i = 0; i < pinnedDigests.length; i++) {
    const bytes = await readFile(resolve("scripts/release-manifests/0b0632d9", i + ".json"));
    if (digest(bytes) !== pinnedDigests[i]) throw new Error("Pinned release inventory hash mismatch");
    Object.assign(assets, JSON.parse(bytes.toString("utf8")));
  }
  if (Object.keys(assets).length !== 814) throw new Error("Pinned release inventory incomplete");
  return validateManifest({version: 1, deployment: previousSite, assets});
}

async function latestPublishedRelease(): Promise<Release | undefined> {
  // The first deployment has no manifest. Subsequent builds read the exact
  // public asset inventory of the active deployment, never a second build.
  const res = await fetch(publicSite + manifestPath, {
    redirect: "error", signal: AbortSignal.timeout(12000), headers: {"cache-control": "no-cache", accept: "application/json"},
  });
  if (res.status === 404 || (res.ok && !(res.headers.get("content-type") || "").includes("application/json"))) {
    await res.body?.cancel();
    return undefined;
  }
  if (!res.ok) { await res.body?.cancel(); throw new Error("Cannot read published release manifest: HTTP " + res.status); }
  return validateManifest(JSON.parse((await boundedBody(res, maxManifest)).toString("utf8")));
}

async function main() {
  const dir = resolve("dist/assets");
  // Capture only the fresh build before retaining earlier files. This keeps
  // future manifests bounded to one generation instead of growing forever.
  const deployment = process.env.CF_PAGES_URL || publicSite;
  const fresh = validateManifest({version: 1, deployment, assets: await captureFreshAssets(dir)});
  const releases = [await bootstrapRelease()];
  try {
    const last = await latestPublishedRelease();
    if (last) releases.push(last);
  } catch (error) {
    // A published Pages production build must not silently skip the active
    // release. Local builds can still use the pinned, verified baseline.
    if (process.env.CF_PAGES === "1" && process.env.CF_PAGES_BRANCH === "main") throw error;
    console.warn("[release] Active manifest unavailable; retaining pinned baseline:", (error as Error).message);
  }
  const stats = await retainAssets(dir, resolve("node_modules/.cache/atoman-retained-assets"), releases);
  await mkdir(resolve("dist/.well-known"), {recursive: true});
  const manifest = JSON.stringify(fresh);
  if (Buffer.byteLength(manifest) > maxManifest) throw new Error("Fresh manifest exceeds limit");
  await writeFile(resolve("dist" + manifestPath), manifest);
  console.log("[release]", JSON.stringify({...stats, fresh: Object.keys(fresh.assets).length, deployment}));
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] || "")).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
