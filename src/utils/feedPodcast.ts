import type { FeedItem } from "@/types";

type FeedAttachment = Pick<FeedItem, "enclosure_url" | "enclosure_type">;
type PlayableFeedPodcast<T extends FeedAttachment> = T & {
  enclosure_url: string;
  enclosure_type: string;
};

export function isPlayableFeedPodcast<T extends FeedAttachment>(
  item: T | null | undefined,
): item is PlayableFeedPodcast<T> {
  return Boolean(
    item?.enclosure_url?.trim() &&
      item.enclosure_type?.trim().toLowerCase().startsWith("audio/"),
  );
}
