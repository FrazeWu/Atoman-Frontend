import { defineStore } from "pinia";
import { ref } from "vue";
import { hasPersistedPlayableState } from "@/utils/playerState";

function hasPersistedPlayableSong() {
	if (typeof localStorage === "undefined") return false;
	return hasPersistedPlayableState(localStorage.getItem("playbackState"));
}

export const usePlayerPresenceStore = defineStore("playerPresence", () => {
	const hasCurrentTrack = ref(hasPersistedPlayableSong());
	const lyricsCloseRequest = ref(0);

	const setHasCurrentTrack = (value: boolean) => {
		hasCurrentTrack.value = value;
	};

	const requestLyricsClose = () => {
		lyricsCloseRequest.value += 1;
	};

	return {
		hasCurrentTrack,
		lyricsCloseRequest,
		setHasCurrentTrack,
		requestLyricsClose,
	};
});
