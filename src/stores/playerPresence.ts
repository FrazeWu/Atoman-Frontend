import { defineStore } from "pinia";
import { ref } from "vue";

function hasPersistedPlayableSong() {
	if (typeof localStorage === "undefined") return false;

	try {
		const state = JSON.parse(localStorage.getItem("playbackState") || "null");
		return Boolean(state?.song?.id && state.song.audio_url?.trim());
	} catch {
		return false;
	}
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
