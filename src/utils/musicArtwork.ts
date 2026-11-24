// Select reliably accessible artwork for server-rendered public metadata.
// Discogs images in this catalogue are accessible to some clients, but the
// audit crawler receives 403. Keep the source in the catalogue and do not
// proxy it or claim a generic placeholder is a real entity image.
export function selectPublicMusicSeoArtwork(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const url = candidate.trim();
    if (!url) continue;
    if (/^\/(?![\/\\])/.test(url)) return url;
    try {
      const parsed = new URL(url);
      if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password ||
          parsed.hostname.toLowerCase().replace(/\.$/, "") === "i.discogs.com") continue;
      return url;
    } catch { /* Invalid or unsupported artwork source. */ }
  }
  return undefined;
}
