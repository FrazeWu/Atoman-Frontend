export function computeBufferedTime(audio: HTMLAudioElement | null): number {
	if (!audio || !audio.buffered || audio.buffered.length === 0) {
		return 0;
	}
	const ct = audio.currentTime;
	for (let i = 0; i < audio.buffered.length; i++) {
		if (audio.buffered.start(i) <= ct && ct <= audio.buffered.end(i)) {
			return audio.buffered.end(i);
		}
	}
	return audio.buffered.end(audio.buffered.length - 1);
}
