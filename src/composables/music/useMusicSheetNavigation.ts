import { computed, toValue, type MaybeRefOrGetter } from "vue";
import {
	listMusicAlbums,
	listMusicArtists,
	listMusicPlaylists,
	listMusicSongs,
	type MusicAlbumListItem,
	type MusicArtistListItem,
	type MusicPlaylistSummary,
	type MusicSongListItem,
} from "@/api/musicV1";
import {
	useSheetNavigation,
	type SheetNavigationItem,
} from "@/composables/useSheetNavigation";

export type MusicNavigableKind = "artist" | "album" | "song" | "playlist";

const pageSize = 100;

export function useMusicSheetNavigation(
	kind: MusicNavigableKind,
	currentId: MaybeRefOrGetter<string | null | undefined>,
	onNavigate: (id: string) => void,
	enabled: MaybeRefOrGetter<boolean> = true,
) {
	const loadItems = async (): Promise<SheetNavigationItem[]> => {
		const requestedId = toValue(currentId) || "";
		const items: SheetNavigationItem[] = [];
		let page = 1;

		while (true) {
			let response: {
				data: unknown[];
				meta?: { has_more?: boolean };
			};
			switch (kind) {
				case "artist":
					response = await listMusicArtists({ page, page_size: pageSize });
					items.push(...(response.data as MusicArtistListItem[]).map((item) => ({
						id: String(item.id),
						label: item.display_name || item.name || "未命名艺术家",
					})));
					break;
				case "album":
					response = await listMusicAlbums({
						page,
						page_size: pageSize,
						sort: "-release_date",
					});
					items.push(...(response.data as MusicAlbumListItem[]).map((item) => ({
						id: String(item.id),
						label: item.title || "未命名专辑",
					})));
					break;
				case "song":
					response = await listMusicSongs({
						page,
						page_size: pageSize,
						sort: "-release_date",
					});
					items.push(...(response.data as MusicSongListItem[]).map((item) => ({
						id: String(item.id),
						label: item.title || "未命名歌曲",
					})));
					break;
				case "playlist":
					response = await listMusicPlaylists({ page, page_size: pageSize });
					items.push(...(response.data as MusicPlaylistSummary[]).map((item) => ({
						id: String(item.id),
						label: item.name || "未命名歌单",
					})));
					break;
			}

			const currentIndex = items.findIndex((item) => item.id === requestedId);
			const hasMore = response.meta?.has_more === true;
			if (!hasMore || response.data.length === 0 || (currentIndex >= 0 && currentIndex < items.length - 1)) {
				return items;
			}
			page += 1;
		}
	};

	const navigation = useSheetNavigation(
		computed(() => toValue(currentId) || ""),
		loadItems,
		onNavigate,
		enabled,
	);

	return navigation;
}
