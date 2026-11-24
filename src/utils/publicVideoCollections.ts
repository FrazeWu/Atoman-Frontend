type PublicCollection = Record<string, unknown> & { id: string; name: string };

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

// Only use collections attached to published public videos. The anonymous
// video API returns embedded collection metadata without a visibility field;
// explicitly non-public collections must still never be linked.
export function publicVideoCollections(videos: readonly unknown[]): PublicCollection[] {
  const collections = new Map<string, PublicCollection>();
  for (const value of videos) {
    const video = record(value);
    if (!video || video.visibility !== "public" || video.status !== "published") continue;
    for (const entry of [video.collection, ...(Array.isArray(video.collections) ? video.collections : [])]) {
      const collection = record(entry);
      if (!collection) continue;
      const { id, name, visibility, status, lifecycle_status, entry_status } = collection;
      if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(id) ||
          typeof name !== "string" || !name.trim() ||
          (visibility != null && visibility !== "public") ||
          (status != null && !["active", "open", "published"].includes(String(status))) ||
          (lifecycle_status != null && lifecycle_status !== "active") ||
          (entry_status != null && entry_status !== "open")) continue;
      if (!collections.has(id)) collections.set(id, { ...collection, id, name: name.trim() });
    }
  }
  return [...collections.values()];
}
