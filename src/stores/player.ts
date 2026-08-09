import { reportError } from "@/utils/logger";
import { apiRequest } from "@/api/client";
import { defineStore } from "pinia";
import { ref, watch } from "vue";
import type { Song, RepeatMode, TimelineItem, PodcastEpisode } from "@/types";
import { useApi } from "@/composables/useApi";
import { recordMusicSongPlay } from "@/api/musicV1";
import {
  readPodcastProgress,
  writePodcastProgress,
} from "@/composables/usePodcastProgress";
import {
  createContentConsumptionTracker,
  useContentLifecycle,
} from "@/composables/useContentLifecycle";
import { useAuthStore } from "@/stores/auth";
import { useAudioPlayerSync } from "@/composables/useAudioPlayerSync";

const api = useApi();

export type PlaybackMode = "loop" | "single" | "random";

type PersistedPlaybackState = {
  song?: Song;
  queue?: Song[];
  currentAlbum?: Song[] | null;
  currentTime?: number;
  volume?: number;
  isShuffled?: boolean;
  repeatMode?: RepeatMode;
  playbackMode?: PlaybackMode;
};

function resolveUploadedMediaUrl(url: string) {
  if (!url.startsWith("/uploads/")) return url;
  if (!api.url.startsWith("http://") && !api.url.startsWith("https://"))
    return url;
  return `${new URL(api.url).origin}${url}`;
}

export const usePlayerStore = defineStore("player", () => {
  const lifecycle = useContentLifecycle();
  const authStore = useAuthStore();
  const { 
    broadcastPlayRequest, 
    setForeignPlayRequestCallback, 
    setupMediaSession, 
    updateMediaSessionMetadata, 
    updateMediaSessionPosition 
  } = useAudioPlayerSync();
  const songs = ref<Song[]>([]);
  const currentSong = ref<Song | null>(null);
  const isPlaying = ref(false);
  const isShuffled = ref(false);
  const repeatMode = ref<RepeatMode>("all");
  const playbackMode = ref<PlaybackMode>("loop");
  const volume = ref(1);
  const currentTime = ref(0);
  const duration = ref(0);
  const songLibraryLoading = ref(false);
  const songLibraryBootstrapped = ref(false);
  const songLibraryLoaded = ref(false);
  const showLyrics = ref(false);
  const showQueue = ref(false);
  const isPinned = ref(
    typeof localStorage === "undefined" ||
      localStorage.getItem("playerPinned") !== "false",
  );

  watch(isPinned, (value) => {
    if (typeof localStorage !== "undefined")
      localStorage.setItem("playerPinned", String(value));
  });

  // Album-based queue
  const queue = ref<Song[]>([]);
  const shuffledQueue = ref<Song[]>([]);
  const currentAlbum = ref<Song[] | null>(null);

  const shuffleArray = <T>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const recomputeShuffledQueue = () => {
    if (!isShuffled.value) {
      shuffledQueue.value = [];
      return;
    }
    const list = queue.value.length > 0 ? queue.value : songs.value;
    if (list.length === 0) return;
    
    const newList = shuffleArray(list);
    if (currentSong.value) {
      const idx = newList.findIndex(s => s.id === currentSong.value?.id);
      if (idx > -1) {
        newList.splice(idx, 1);
        newList.unshift(currentSong.value);
      }
    }
    shuffledQueue.value = newList;
  };

  watch(isShuffled, () => recomputeShuffledQueue());
  watch(queue, () => {
    if (isShuffled.value) recomputeShuffledQueue();
  }, { deep: true });

  // Sync isShuffled and repeatMode based on playbackMode
  watch(
    playbackMode,
    (mode) => {
      switch (mode) {
        case "loop":
          isShuffled.value = false;
          repeatMode.value = "all";
          break;
        case "single":
          isShuffled.value = false;
          repeatMode.value = "one";
          break;
        case "random":
          isShuffled.value = true;
          repeatMode.value = "all";
          break;
      }
    },
    { immediate: true },
  );

  let audio: HTMLAudioElement | null = null;
  let songsRequest: Promise<void> | null = null;
  
  setForeignPlayRequestCallback(() => {
    if (isPlaying.value && audio) {
      savePodcastProgress();
      audio.pause();
      isPlaying.value = false;
      pauseListening();
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    }
  });
  const listeningThresholdMs = 5000;
  let listeningTimer: ReturnType<typeof setTimeout> | null = null;
  let listeningStartedAt: number | null = null;
  let listenedMs = 0;
  let listeningSongId: string | null = null;
  let playReported = false;
  let podcastTracker: ReturnType<
    typeof createContentConsumptionTracker
  > | null = null;

  const clearListeningTimer = () => {
    if (listeningTimer === null) return;
    clearTimeout(listeningTimer);
    listeningTimer = null;
  };

  const pauseListening = () => {
    if (listeningStartedAt !== null) {
      listenedMs += Date.now() - listeningStartedAt;
      listeningStartedAt = null;
    }
    clearListeningTimer();
  };

  const reportCurrentPlay = () => {
    const songId = currentSong.value?.id ? String(currentSong.value.id) : null;
    if (!songId || songId !== listeningSongId || playReported) return;
    playReported = true;
    listeningStartedAt = null;
    listeningTimer = null;
    void recordMusicSongPlay(songId).catch((error) => {
      reportError(error, "Failed to record music play:");
    });
  };

  const resumeListening = () => {
    if (!listeningSongId || playReported || listeningStartedAt !== null) return;
    listeningStartedAt = Date.now();
    listeningTimer = setTimeout(
      reportCurrentPlay,
      Math.max(0, listeningThresholdMs - listenedMs),
    );
  };

  const resetListening = (song: Song) => {
    pauseListening();
    listenedMs = 0;
    listeningSongId =
      !song.source_type || song.source_type === "music"
        ? String(song.id)
        : null;
    playReported = false;
  };

  let preloaderAudio: HTMLAudioElement | null = null;
  let fadeAnimationId: number | null = null;

  const fadeAudioVolume = (
    playerEl: HTMLAudioElement,
    targetVol: number,
    durationMs: number = 300
  ): Promise<void> => {
    return new Promise((resolve) => {
      if (fadeAnimationId !== null) {
        cancelAnimationFrame(fadeAnimationId);
        fadeAnimationId = null;
      }
      const startVol = playerEl.volume;
      const startTime = performance.now();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        playerEl.volume = Math.max(0, Math.min(1, startVol + (targetVol - startVol) * progress));

        if (progress < 1) {
          fadeAnimationId = requestAnimationFrame(step);
        } else {
          fadeAnimationId = null;
          resolve();
        }
      };

      fadeAnimationId = requestAnimationFrame(step);
    });
  };

  const preloadNextSong = () => {
    const list = getActiveList();
    if (!list.length || !currentSong.value) return;
    const currentIndex = list.findIndex((s) => s.id === currentSong.value?.id);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + 1) % list.length;
    const nextSong = list[nextIndex];
    if (!nextSong || !nextSong.audio_url) return;

    if (!preloaderAudio) {
      preloaderAudio = new Audio();
    }
    if (preloaderAudio.src !== nextSong.audio_url) {
      preloaderAudio.src = nextSong.audio_url;
      preloaderAudio.preload = "auto";
    }
  };

  const ensureAudio = () => {
    if (audio) return audio;

    const nextAudio = new Audio();
    nextAudio.addEventListener("timeupdate", () => {
      currentTime.value = nextAudio.currentTime;
      savePodcastProgress();
      if (duration.value > 0) {
        updateMediaSessionPosition({
          duration: duration.value,
          playbackRate: nextAudio.playbackRate,
          position: currentTime.value
        });
        if (duration.value - nextAudio.currentTime <= 8) {
          preloadNextSong();
        }
      }
    });
    nextAudio.addEventListener("durationchange", () => {
      duration.value = Number.isFinite(nextAudio.duration)
        ? nextAudio.duration
        : 0;
      updateMediaSessionPosition({
        duration: duration.value,
        playbackRate: nextAudio.playbackRate,
        position: currentTime.value
      });
    });
    nextAudio.addEventListener("ended", () => {
      savePodcastProgress(true);
      playNext();
    });
    nextAudio.volume = volume.value;

    if (currentSong.value) {
      nextAudio.src = currentSong.value.audio_url;
      if (currentTime.value > 0) {
        nextAudio.currentTime = currentTime.value;
      }
    }

    setupMediaSession({
      play: togglePlay,
      pause: togglePlay,
      previoustrack: playPrevious,
      nexttrack: playNext,
      seekto: (details) => {
        if (details.seekTime !== undefined) {
          seek(details.seekTime);
        }
      }
    });

    audio = nextAudio;
    return nextAudio;
  };

  const syncCurrentSongFromLibrary = (library: Song[]) => {
    if (!currentSong.value) return;

    const refreshedSong = library.find(
      (song) => song.id === currentSong.value?.id,
    );
    if (!refreshedSong) return;

    currentSong.value = refreshedSong;

    if (!audio) return;

    audio.src = refreshedSong.audio_url;
    audio.volume = volume.value;
    if (currentTime.value > 0) {
      audio.currentTime = currentTime.value;
    }
  };

  const attemptPlay = (player: HTMLAudioElement) => {
    player.volume = volume.value;
    player
      .play()
      .then(() => {
        isPlaying.value = true;
        broadcastPlayRequest();
        resumeListening();
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
      })
      .catch(() => {
        isPlaying.value = false;
        pauseListening();
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }
      });
  };

  const savePlaybackState = () => {
    if (typeof localStorage === "undefined") return;

    if (!currentSong.value) {
      localStorage.removeItem("playbackState");
      return;
    }

    const state: PersistedPlaybackState = {
      song: currentSong.value,
      queue: queue.value,
      currentAlbum: currentAlbum.value,
      currentTime: audio?.currentTime ?? currentTime.value,
      volume: volume.value,
      isShuffled: isShuffled.value,
      repeatMode: repeatMode.value,
      playbackMode: playbackMode.value,
    };

    localStorage.setItem("playbackState", JSON.stringify(state));
  };

  const restorePlaybackState = () => {
    if (typeof localStorage === "undefined") return;

    const savedState = localStorage.getItem("playbackState");
    if (!savedState) return;

    try {
      const state = JSON.parse(savedState) as PersistedPlaybackState;
      volume.value = typeof state.volume === "number" ? state.volume : 1;
      isShuffled.value = Boolean(state.isShuffled);
      repeatMode.value = state.repeatMode || "all";
      playbackMode.value = state.playbackMode || "loop";
      currentTime.value =
        typeof state.currentTime === "number" ? state.currentTime : 0;
      currentSong.value = state.song || null;
      queue.value = Array.isArray(state.queue)
        ? state.queue
        : state.song
          ? [state.song]
          : [];
      currentAlbum.value = Array.isArray(state.currentAlbum)
        ? state.currentAlbum
        : null;
      isPlaying.value = false;
    } catch (error) {
      reportError(error, "Failed to restore playback state:");
    }
  };

  restorePlaybackState();

  watch(
    [
      currentSong,
      currentTime,
      volume,
      isPlaying,
      isShuffled,
      repeatMode,
      playbackMode,
      queue,
      currentAlbum,
    ],
    () => {
      savePlaybackState();
    },
    { deep: true },
  );

  const fetchSongs = async (force = false) => {
    if (songsRequest) return songsRequest;
    if (songLibraryLoaded.value && !force) return;

    songLibraryLoading.value = true;
    songsRequest = (async () => {
      try {
        const response = await apiRequest(`${api.url}/songs`);
        if (!response.ok) {
          songLibraryLoaded.value = false;
          return;
        }

        const library = (await response.json()) as Song[];
        songs.value = library;
        songLibraryLoaded.value = true;
        syncCurrentSongFromLibrary(library);
      } catch (error) {
        songLibraryLoaded.value = false;
        reportError(error, "Failed to fetch songs:");
      } finally {
        songLibraryBootstrapped.value = true;
        songLibraryLoading.value = false;
        songsRequest = null;
      }
    })();

    return songsRequest;
  };

  const startSong = (song: Song) => {
    savePodcastProgress();
    resetListening(song);
    const player = ensureAudio();
    player.src = song.audio_url;
    player.volume = volume.value;
    currentSong.value = song;
    const savedProgress =
      song.source_type === "podcast_episode" && song.source_id
        ? readPodcastProgress(song.source_id)
        : null;
    currentTime.value = savedProgress?.completed
      ? 0
      : savedProgress?.position_sec || 0;
    duration.value = 0;
    podcastTracker = null;
    
    updateMediaSessionMetadata({
      title: song.title,
      artist: song.artist || '未知艺术家',
      album: song.album || '未知专辑',
      artworkUrl: song.cover_url || ''
    });

    if (song.source_type === "podcast_episode" && song.source_id) {
      const episodeID = song.source_id;
      podcastTracker = createContentConsumptionTracker({
        onEvent: (event) => {
          void lifecycle
            .recordEvent({
              module: "podcast",
              content_id: episodeID,
              event,
              position_sec: Math.floor(currentTime.value),
              duration_sec: Math.floor(duration.value),
              progress:
                duration.value > 0 ? currentTime.value / duration.value : 0,
            })
            .catch(() => undefined);
        },
        onProgress: (progress) => {
          if (!authStore.token) return;
          void lifecycle
            .saveProgress({
              module: "podcast",
              content_id: episodeID,
              position_sec: Math.floor(currentTime.value),
              duration_sec: Math.floor(duration.value),
              progress,
              completed: progress >= 0.95,
            })
            .catch(() => undefined);
        },
      });
      podcastTracker.open();
    }
    attemptPlay(player);
  };

  const playSong = (song: Song) => {
    if (currentSong.value?.id === song.id) {
      togglePlay();
      return;
    }

    currentAlbum.value = null;
    queue.value = [song];
    startSong(song);
  };

  const playQueuedSong = (song: Song) => {
    if (currentSong.value?.id === song.id) {
      togglePlay();
      return;
    }

    startSong(song);
  };

  const addToQueue = (song: Song, playNext = false) => {
    if (queue.value.some((item) => item.id === song.id)) return;
    if (playNext && currentSong.value) {
      const index = queue.value.findIndex(
        (item) => item.id === currentSong.value?.id,
      );
      queue.value.splice(Math.max(0, index + 1), 0, song);
      return;
    }
    queue.value.push(song);
  };

  const removeFromQueue = (songID: Song["id"]) => {
    if (currentSong.value?.id === songID) return;
    queue.value = queue.value.filter((song) => song.id !== songID);
  };

  const clearQueue = () => {
    queue.value = currentSong.value ? [currentSong.value] : [];
  };

  const moveQueueItem = (from: number, to: number) => {
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= queue.value.length ||
      to >= queue.value.length
    )
      return;
    const [song] = queue.value.splice(from, 1);
    queue.value.splice(to, 0, song);
  };

  const playAlbum = (albumSongs: Song[], startIndex = 0) => {
    if (albumSongs.length === 0) return;

    currentAlbum.value = albumSongs;
    queue.value = [...albumSongs];

    startSong(albumSongs[startIndex]);
  };

  const togglePlay = () => {
    if (!currentSong.value) return;

    const player = ensureAudio();
    if (!player.src) {
      player.src = currentSong.value.audio_url;
    }
    player.volume = volume.value;
    if (currentTime.value > 0) {
      player.currentTime = currentTime.value;
    }

    if (isPlaying.value) {
      savePodcastProgress();
      player.pause();
      isPlaying.value = false;
      pauseListening();
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    } else {
      if (listeningSongId !== String(currentSong.value.id))
        resetListening(currentSong.value);
      attemptPlay(player);
    }
  };

  const getActiveList = () => {
    if (isShuffled.value && shuffledQueue.value.length > 0) return shuffledQueue.value;
    return queue.value.length > 0 ? queue.value : songs.value;
  };

  const playNext = () => {
    const list = getActiveList();
    if (!currentSong.value || list.length === 0) return;

    const currentIndex = list.findIndex(
      (song) => song.id === currentSong.value?.id,
    );
    const player = ensureAudio();

    let nextIndex;
    if (repeatMode.value === "one") {
      player.currentTime = 0;
      currentTime.value = 0;
      resetListening(currentSong.value);
      attemptPlay(player);
      return;
    } else if (repeatMode.value === "all" || currentIndex < list.length - 1) {
      nextIndex = (currentIndex + 1) % list.length;
    } else {
      isPlaying.value = false;
      return;
    }

    startSong(list[nextIndex]);
  };

  const playPrevious = () => {
    const list = getActiveList();
    if (!currentSong.value || list.length === 0) return;

    const currentIndex = list.findIndex(
      (song) => song.id === currentSong.value?.id,
    );
    const prevIndex = (currentIndex - 1 + list.length) % list.length;
    startSong(list[prevIndex]);
  };

  const toggleShuffle = () => {
    isShuffled.value = !isShuffled.value;
  };

  const toggleRepeat = () => {
    const modes: RepeatMode[] = ["none", "all", "one"];
    const nextMode =
      modes[(modes.indexOf(repeatMode.value) + 1) % modes.length];
    repeatMode.value = nextMode;
  };

  const cyclePlaybackMode = () => {
    const modes: PlaybackMode[] = ["loop", "single", "random"];
    const currentIndex = modes.indexOf(playbackMode.value);
    playbackMode.value = modes[(currentIndex + 1) % modes.length];
  };

  const createPodcastSong = (
    feedItem: TimelineItem["feed_item"],
  ): Song | null => {
    if (!feedItem) return null;

    return {
      id: Number(feedItem.id),
      source_type: "feed_podcast",
      source_id: String(feedItem.id),
      title: feedItem.title || "未知播客",
      artist: feedItem.author || feedItem.feed_source?.title || "Podcast",
      album: feedItem.feed_source?.title || "Podcast",
      album_id: -1,
      year: new Date(feedItem.published_at || "").getFullYear() || 0,
      release_date: feedItem.published_at || "",
      lyrics: feedItem.summary || "",
      audio_url: feedItem.enclosure_url || "",
      media_kind: "feed_item",
      cover_url: feedItem.image_url || feedItem.feed_source?.cover_url || "",
      status: "approved" as const,
    };
  };

  const episodeCover = (episode: PodcastEpisode) =>
    episode.episode_cover_url ||
    episode.post?.cover_url ||
    episode.post?.collections?.[0]?.cover_url ||
    episode.collections?.[0]?.cover_url ||
    episode.channel?.cover_url ||
    "";

  const createPodcastEpisodeSong = (episode: PodcastEpisode): Song => ({
    id: `podcast:${episode.id}`,
    source_type: "podcast_episode",
    source_id: episode.id,
    title: episode.post?.title || "未命名单集",
    artist: episode.channel?.name || "播客",
    album:
      episode.post?.collections?.[0]?.name ||
      episode.collections?.[0]?.name ||
      episode.channel?.name ||
      "播客",
    album_id:
      episode.post?.collections?.[0]?.id ||
      episode.collections?.[0]?.id ||
      episode.channel_id,
    year: new Date(episode.created_at || "").getFullYear() || 0,
    release_date: episode.created_at || "",
    lyrics: episode.post?.content || "",
    audio_url: resolveUploadedMediaUrl(episode.audio_url),
    cover_url: resolveUploadedMediaUrl(episodeCover(episode)),
    track_number: episode.episode_number,
    status: "approved",
  });

  const setQueueFromCurrentItems = (items: TimelineItem[]) => {
    const podcastSongs: Song[] = items
      .filter(
        (item) => item.type === "feed_item" && item.feed_item?.enclosure_url,
      )
      .map((item) => createPodcastSong(item.feed_item))
      .filter((song): song is Song => Boolean(song));
    queue.value = podcastSongs;
  };

  const setQueueFromPodcastEpisodes = (episodes: PodcastEpisode[]) => {
    queue.value = episodes.map(createPodcastEpisodeSong);
  };

  function savePodcastProgress(completed = false) {
    const song = currentSong.value;
    if (song?.source_type !== "podcast_episode" || !song.source_id) return;
    const playerDuration = audio?.duration;
    const durationSec = Number.isFinite(playerDuration)
      ? Math.floor(playerDuration || 0)
      : Math.floor(duration.value || 0);
    writePodcastProgress({
      episode_id: song.source_id,
      position_sec: Math.floor(audio?.currentTime ?? currentTime.value),
      duration_sec: durationSec,
      completed,
      last_played_at: new Date().toISOString(),
    });
    podcastTracker?.update(
      completed
        ? 1
        : durationSec > 0
          ? Math.floor(audio?.currentTime ?? currentTime.value) / durationSec
          : 0,
    );
  }

  const setVolume = (v: number) => {
    volume.value = v;
    if (audio) {
      audio.volume = v;
    }
  };

  const seek = (time: number) => {
    currentTime.value = time;
    if (audio) {
      audio.currentTime = time;
    }
  };

  const skip = (seconds: number) => {
    if (!audio) return;
    const newTime = Math.max(
      0,
      Math.min(audio.currentTime + seconds, duration.value),
    );
    seek(newTime);
  };

  const toggleLyrics = () => {
    showLyrics.value = !showLyrics.value;
  };

  const toggleQueue = () => {
    showQueue.value = !showQueue.value;
  };

  const togglePinned = () => {
    isPinned.value = !isPinned.value;
  };

  return {
    songs,
    currentSong,
    isPlaying,
    isShuffled,
    repeatMode,
    playbackMode,
    volume,
    currentTime,
    duration,
    songLibraryLoading,
    songLibraryBootstrapped,
    queue,
    currentAlbum,
    fetchSongs,
    playSong,
    playQueuedSong,
    addToQueue,
    removeFromQueue,
    clearQueue,
    moveQueueItem,
    playAlbum,
    togglePlay,
    playNext,
    playPrevious,
    toggleShuffle,
    toggleRepeat,
    cyclePlaybackMode,
    createPodcastSong,
    createPodcastEpisodeSong,
    setQueueFromCurrentItems,
    setQueueFromPodcastEpisodes,
    setVolume,
    seek,
    skip,
    showLyrics,
    toggleLyrics,
    showQueue,
    toggleQueue,
    isPinned,
    togglePinned,
  };
});
