import { useMusicWorkspaceStore, type DrawerState } from "@/stores/musicWorkspace";
import { getActivePinia, setActivePinia, createPinia } from "pinia";
import { toRef, getCurrentInstance, type Ref } from "vue";

export type {
	MusicEditorEntity,
	MusicEditorMode,
	MusicEditorState,
} from "@/components/music/musicSheetTypes";

export { useMusicWorkspaceStore };

let sharedPinia: ReturnType<typeof createPinia> | null = null;

function ensurePinia() {
	const instance = getCurrentInstance();
	if (instance && !instance.appContext.config.globalProperties.$pinia) {
		if (!sharedPinia) {
			sharedPinia = createPinia();
		}
		try {
			instance.appContext.app.use(sharedPinia);
		} catch {}
		return sharedPinia;
	}
	let pinia: any = null;
	if (!instance) {
		pinia = getActivePinia();
	}
	if (!pinia) {
		if (!sharedPinia) {
			sharedPinia = createPinia();
		}
		setActivePinia(sharedPinia);
		return sharedPinia;
	}
	return pinia;
}

export function useMusicDrawers() {
	const pinia = ensurePinia();
	const store = useMusicWorkspaceStore(pinia);

	return {
		state: store.state as unknown as Ref<DrawerState> & DrawerState,
		openArtist: store.openArtist,
		closeArtist: store.closeArtist,
		refreshArtist: store.refreshArtist,
		replaceArtist: store.replaceArtist,
		openAlbum: store.openAlbum,
		closeAlbum: store.closeAlbum,
		refreshAlbum: store.refreshAlbum,
		replaceAlbum: store.replaceAlbum,
		refreshSong: store.refreshSong,
		openSong: store.openSong,
		closeSong: store.closeSong,
		replaceSong: store.replaceSong,
		openPlaylist: store.openPlaylist,
		closePlaylist: store.closePlaylist,
		replacePlaylist: store.replacePlaylist,
		refreshPlaylists: store.refreshPlaylists,
		openNestedAction: store.openNestedAction,
		closeNestedAction: store.closeNestedAction,
		openMusicEditor: store.openMusicEditor,
		closeMusicEditor: store.closeMusicEditor,
		openMusicCreationFlow: store.openMusicCreationFlow,
		openMusicContributorFlow: store.openMusicContributorFlow,
		completeMusicContributorFlow: store.completeMusicContributorFlow,
		resumeMusicCreationFlow: store.resumeMusicCreationFlow,
		setMusicCreationStep: store.setMusicCreationStep,
		closeMusicCreationFlow: store.closeMusicCreationFlow,
		closeAll: store.closeAll,
		isMainShifted: toRef(store, "isMainShifted"),
		isArtistShifted: toRef(store, "isArtistShifted"),
		isAlbumShifted: toRef(store, "isAlbumShifted"),
		isCreationFlowOpen: toRef(store, "isCreationFlowOpen"),
		isMusicEditorOpen: toRef(store, "isMusicEditorOpen"),
		layers: toRef(store, "layers"),
		renderLayers: toRef(store, "renderLayers"),
		topLayer: toRef(store, "topLayer"),
		popLayer: store.popLayer,
		popToLayer: store.popToLayer,
		returnToLayer: store.returnToLayer,
		isTopLayer: store.isTopLayer,
		isLayerActive: store.isLayerActive,
		isLayerShifted: store.isLayerShifted,
	};
}
