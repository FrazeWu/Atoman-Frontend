// Exact, bounded recovery of immutable assets from the previously deployed
// release. The manifest is produced from that deployment, not a second build.
// A future release should retain the previous deployment and its manifest.
const previousDeployment = "https://0b0632d9.atoman-frontend.pages.dev";
const manifestRoot = "release-recovery/v1/0b0632d9/";
const manifestDigests = [
  "d0507751a9424241d7cf8e75a49454d6c34126d281af76488ffd6c67cab7b70f",
  "ba7d192ed7df4473ef1ba5252a7de6d4e4b932b8f2935079a80ed3df7348f07a",
  "d39e195ecfad41ea1967753c27e188026365a218d8ba5c687bc5a5d236fa61b6",
  "5efce07069b7daad960eec5f5f4a65d9d6db85180ac7c8895b503439ffbc19b4",
  "e526319d92fbda8250e1309d6584d67dc9114c7ba5583389f07c0a6d81d0ec99",
  "7bb6308b530c49d92ebb69f21d4ed2e48086215076d8e5830069aca48fcd0c15",
  "660f89959597ab3d14374e0cf6037eae7b61f584a3c85b780f70292676c1d2ca",
  "8bbb8528c63382e93e50a4d20df9ed624ce8834dd7f1d526f516eb3483f203f7",
] as const;
const maxAssetBytes = 16 * 1024 * 1024;
const maxManifestBytes = 64 * 1024;
const hashedAsset = /^assets\/([A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8,}\.(?:js|mjs|css|json|wasm|woff2?|ttf|otf|png|jpe?g|svg|webp|avif|gif|ico))$/;
const types: Record<string, string> = {
  js: "application/javascript; charset=utf-8", mjs: "application/javascript; charset=utf-8",
  css: "text/css; charset=utf-8", json: "application/json", wasm: "application/wasm",
  woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml",
  webp: "image/webp", avif: "image/avif", gif: "image/gif", ico: "image/x-icon",
};
export type RecoveryBucket = {
  get: (key: string) => Promise<{body: ReadableStream; httpEtag: string; httpMetadata?: {contentType?: string}} | null>;
  put?: (key: string, bytes: ArrayBuffer, options: {onlyIf: Headers; httpMetadata: {contentType: string}; sha256: string}) => Promise<unknown>;
};

async function boundedBytes(body: ReadableStream | null, max: number): Promise<ArrayBuffer> {
  if (!body) throw new Error("Missing body");
  const reader = body.getReader();
  const pieces: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) { await reader.cancel(); throw new Error("Asset exceeds limit"); }
      pieces.push(value);
    }
  } finally { reader.releaseLock(); }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const piece of pieces) { out.set(piece, offset); offset += piece.byteLength; }
  return out.buffer;
}
async function hash(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
function temporaryFailure(method: string, stage: string, diagnostic: boolean): Response {
  return new Response(method === "HEAD" ? null : "Release asset temporarily unavailable", {
    status: 503, headers: {"content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "retry-after": "60", ...(diagnostic ? {"x-atoman-recovery-stage": stage} : {})},
  });
}
export async function recoverPreviousReleaseAsset(
  key: string,
  method: string,
  bucket?: RecoveryBucket,
  waitUntil?: (promise: Promise<unknown>) => void,
  fetcher: typeof fetch = (input, init) => fetch(input, init),
  diagnostic = false,
): Promise<Response | undefined> {
  const match = hashedAsset.exec(key);
  if (!match || !bucket || (method !== "GET" && method !== "HEAD")) return undefined;
  const name = match[1];
  const shard = name.charCodeAt(0) % 8;
  const expectedManifest = manifestDigests[shard];
  let stage = "manifest-read";
  try {
    const object = await bucket.get(manifestRoot + shard + "-" + expectedManifest + ".json");
    if (!object) return undefined;
    stage = "manifest-verify";
    const bytes = await boundedBytes(object.body, maxManifestBytes);
    if (await hash(bytes) !== expectedManifest) throw new Error("Invalid release manifest");
    const manifest: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!manifest || typeof manifest !== "object" || !Object.prototype.hasOwnProperty.call(manifest, name)) return undefined;
    const entry = (manifest as Record<string, unknown>)[name];
    if (!Array.isArray(entry) || entry.length !== 2 || !Number.isInteger(entry[0]) || entry[0] <= 0 || entry[0] > maxAssetBytes || typeof entry[1] !== "string" || !/^[a-f0-9]{64}$/.test(entry[1])) throw new Error("Invalid release entry");
    const [size, digest] = entry as [number, string];
    stage = "source-fetch";
    const source = await fetcher(previousDeployment + "/" + key, {
      method: "GET", redirect: "error", signal: AbortSignal.timeout(8000),
      headers: {"accept-encoding": "identity"},
    });
    stage = "source-http-" + source.status;
    if (!source.ok || source.redirected || (source.headers.get("content-type") || "").toLowerCase().includes("text/html")) throw new Error("Invalid release source");
    stage = "asset-verify";
    const asset = await boundedBytes(source.body, size);
    if (asset.byteLength !== size || await hash(asset) !== digest) throw new Error("Release bytes do not match manifest");
    const contentType = types[name.split(".").pop()!];
    // Never overwrite an existing immutable object, including a concurrent
    // recovery of the same asset. A verified read works even if archival fails.
    if (bucket.put && waitUntil) {
      try {
        waitUntil(Promise.resolve().then(() => bucket.put!(key, asset, {
          onlyIf: new Headers({"if-none-match": "*"}), httpMetadata: {contentType}, sha256: digest,
        })).catch(() => undefined));
      } catch { /* Archiving is optional once exact bytes are verified. */ }
    }
    return new Response(method === "HEAD" ? null : asset, {
      headers: {"content-type": contentType, "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff", "etag": '"' + digest + '"', "x-atoman-release-recovered": "0b0632d9"},
    });
  } catch { return temporaryFailure(method, stage, diagnostic); }
}
