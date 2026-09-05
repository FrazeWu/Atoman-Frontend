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
		switch (kind) {
			case "artist": {
				const response = await listMusicArtists({ page: 1, page_size: pageSize });
				return response.data.map((item: MusicArtistListItem) => ({
					id: String(item.id),
					label: item.display_name || item.name || "未命名艺术家",
				}));
			}
			case "album": {
				const response = await listMusicAlbums({
					page: 1,
					page_size: pageSize,
					sort: "-release_date",
				});
				return response.data.map((item: MusicAlbumListItem) => ({
					id: String(item.id),
					label: item.title || "未命名专辑",
				}));
			}
			case "song": {
				const response = await listMusicSongs({
					page: 1,
					page_size: pageSize,
					sort: "-release_date",
				});
				return response.data.map((item: MusicSongListItem) => ({
					id: String(item.id),
					label: item.title || "未命名歌曲",
				}));
			}
			case "playlist": {
				const response = await listMusicPlaylists({ page: 1, page_size: pageSize });
				return response.data.map((item: MusicPlaylistSummary) => ({
					id: String(item.id),
					label: item.name || "未命名歌单",
				}));
			}
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
