import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { Song, RepeatMode, TimelineItem, PodcastEpisode } from '@/types';
import { useApi } from '@/composables/useApi'
import { recordMusicSongPlay } from '@/api/musicV1'
import { useAuthStore } from '@/stores/auth'

const api = useApi();

export type PlaybackMode = 'loop' | 'single' | 'random';

type PersistedPlaybackState = {
  song?: Song;
  currentTime?: number;
  volume?: number;
  isShuffled?: boolean;
  repeatMode?: RepeatMode;
  playbackMode?: PlaybackMode;
};

export const usePlayerStore = defineStore('player', () => {
  const songs = ref<Song[]>([]);
  const currentSong = ref<Song | null>(null);
  const isPlaying = ref(false);
  const isShuffled = ref(false);
  const repeatMode = ref<RepeatMode>('all');
  const playbackMode = ref<PlaybackMode>('loop');
  const volume = ref(1);
  const currentTime = ref(0);
  const duration = ref(0);
  const songLibraryLoading = ref(false);
  const songLibraryBootstrapped = ref(false);
  const songLibraryLoaded = ref(false);
  const showLyrics = ref(false);
  const showQueue = ref(false);

  // Album-based queue
  const queue = ref<Song[]>([]);
  const currentAlbum = ref<Song[] | null>(null);

  // Sync isShuffled and repeatMode based on playbackMode
  watch(playbackMode, (mode) => {
    switch (mode) {
      case 'loop':
        isShuffled.value = false;
        repeatMode.value = 'all';
        break;
      case 'single':
        isShuffled.value = false;
        repeatMode.value = 'one';
        break;
      case 'random':
        isShuffled.value = true;
        repeatMode.value = 'all';
        break;
    }
  }, { immediate: true });

  let audio: HTMLAudioElement | null = null;
  let songsRequest: Promise<void> | null = null;
  let lastReportedSongId: string | null = null;
  let lastPodcastProgressSyncAt = 0;

  const ensureAudio = () => {
    if (audio) return audio;

    const nextAudio = new Audio();
    nextAudio.addEventListener('timeupdate', () => {
      currentTime.value = nextAudio.currentTime;
      syncPodcastProgress();
    });
    nextAudio.addEventListener('durationchange', () => {
      duration.value = Number.isFinite(nextAudio.duration) ? nextAudio.duration : 0;
    });
    nextAudio.addEventListener('ended', () => {
      syncPodcastProgress(true);
      playNext();
    });
    nextAudio.volume = volume.value;

    if (currentSong.value) {
      nextAudio.src = currentSong.value.audio_url;
      if (currentTime.value > 0) {
        nextAudio.currentTime = currentTime.value;
      }
    }

    audio = nextAudio;
    return nextAudio;
  };

  const syncCurrentSongFromLibrary = (library: Song[]) => {
    if (!currentSong.value) return;

    const refreshedSong = library.find((song) => song.id === currentSong.value?.id);
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
    player.play()
      .then(() => {
        isPlaying.value = true;
      })
      .catch(() => {
        isPlaying.value = false;
      });
  };

  const savePlaybackState = () => {
    if (typeof localStorage === 'undefined') return;

    if (!currentSong.value) {
      localStorage.removeItem('playbackState');
      return;
    }

    const state: PersistedPlaybackState = {
      song: currentSong.value,
      currentTime: audio?.currentTime ?? currentTime.value,
      volume: volume.value,
      isShuffled: isShuffled.value,
      repeatMode: repeatMode.value,
      playbackMode: playbackMode.value,
    };

    localStorage.setItem('playbackState', JSON.stringify(state));
  };

  const restorePlaybackState = () => {
    if (typeof localStorage === 'undefined') return;

    const savedState = localStorage.getItem('playbackState');
    if (!savedState) return;

    try {
      const state = JSON.parse(savedState) as PersistedPlaybackState;
      volume.value = typeof state.volume === 'number' ? state.volume : 1;
      isShuffled.value = Boolean(state.isShuffled);
      repeatMode.value = state.repeatMode || 'all';
      playbackMode.value = state.playbackMode || 'loop';
      currentTime.value = typeof state.currentTime === 'number' ? state.currentTime : 0;
      currentSong.value = state.song || null;
      isPlaying.value = false;
    } catch (error) {
      console.error('Failed to restore playback state:', error);
    }
  };

  restorePlaybackState();

  watch([currentSong, currentTime, volume, isPlaying, isShuffled, repeatMode, playbackMode], () => {
    savePlaybackState();
  }, { deep: true });

  const fetchSongs = async (force = false) => {
    if (songsRequest) return songsRequest;
    if (songLibraryLoaded.value && !force) return;

    songLibraryLoading.value = true;
    songsRequest = (async () => {
      try {
        const response = await fetch(`${api.url}/songs`);
        if (!response.ok) {
          songLibraryLoaded.value = false;
          return;
        }

        const library = await response.json() as Song[];
        songs.value = library;
        songLibraryLoaded.value = true;
        syncCurrentSongFromLibrary(library);
      } catch (error) {
        songLibraryLoaded.value = false;
        console.error('Failed to fetch songs:', error);
      } finally {
        songLibraryBootstrapped.value = true;
        songLibraryLoading.value = false;
        songsRequest = null;
      }
    })();

    return songsRequest;
  };

  const startSong = (song: Song) => {
    syncPodcastProgress(true);
    const player = ensureAudio();
    player.src = song.audio_url;
    player.volume = volume.value;
    currentSong.value = song;
    currentTime.value = 0;
    duration.value = 0;
    attemptPlay(player);
  };

  watch(currentSong, (song) => {
    if (song?.source_type && song.source_type !== 'music') return
    const songId = song?.id ? String(song.id) : null
    if (!songId || songId === lastReportedSongId) return
    lastReportedSongId = songId
    void recordMusicSongPlay(songId).catch((error) => {
      console.error('Failed to record music play:', error)
    })
  })

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
      syncPodcastProgress(true);
      player.pause();
      isPlaying.value = false;
    } else {
      attemptPlay(player);
    }
  };

  const getActiveList = () => queue.value.length > 0 ? queue.value : songs.value;

  const playNext = () => {
    const list = getActiveList();
    if (!currentSong.value || list.length === 0) return;

    const currentIndex = list.findIndex((song) => song.id === currentSong.value?.id);
    const player = ensureAudio();

    let nextIndex;
    if (isShuffled.value) {
      nextIndex = Math.floor(Math.random() * list.length);
    } else if (repeatMode.value === 'one') {
      player.currentTime = 0;
      currentTime.value = 0;
      attemptPlay(player);
      return;
    } else if (repeatMode.value === 'all' || currentIndex < list.length - 1) {
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

    const currentIndex = list.findIndex((song) => song.id === currentSong.value?.id);
    const prevIndex = (currentIndex - 1 + list.length) % list.length;
    startSong(list[prevIndex]);
  };

  const toggleShuffle = () => {
    isShuffled.value = !isShuffled.value;
  };

  const toggleRepeat = () => {
    const modes: RepeatMode[] = ['none', 'all', 'one'];
    const nextMode = modes[(modes.indexOf(repeatMode.value) + 1) % modes.length];
    repeatMode.value = nextMode;
  };

  const cyclePlaybackMode = () => {
    const modes: PlaybackMode[] = ['loop', 'single', 'random'];
    const currentIndex = modes.indexOf(playbackMode.value);
    playbackMode.value = modes[(currentIndex + 1) % modes.length];
  };

  const createPodcastSong = (feedItem: TimelineItem['feed_item']): Song | null => {
    if (!feedItem) return null;

    return {
      id: Number(feedItem.id),
      source_type: 'feed_podcast',
      source_id: String(feedItem.id),
      title: feedItem.title || '未知播客',
      artist: feedItem.author || feedItem.feed_source?.title || 'Podcast',
      album: feedItem.feed_source?.title || 'Podcast',
      album_id: -1,
      year: new Date(feedItem.published_at || '').getFullYear() || 0,
      release_date: feedItem.published_at || '',
      lyrics: feedItem.summary || '',
      audio_url: feedItem.enclosure_url || '',
      cover_url: feedItem.image_url || feedItem.feed_source?.cover_url || '',
      status: 'approved' as const,
    };
  };

  const episodeCover = (episode: PodcastEpisode) =>
    episode.episode_cover_url
    || episode.post?.cover_url
    || episode.post?.collections?.[0]?.cover_url
    || episode.collections?.[0]?.cover_url
    || episode.channel?.cover_url
    || '';

  const createPodcastEpisodeSong = (episode: PodcastEpisode): Song => ({
    id: `podcast:${episode.id}`,
    source_type: 'podcast_episode',
    source_id: episode.id,
    title: episode.post?.title || '未命名单集',
    artist: episode.channel?.name || '播客',
    album: episode.post?.collections?.[0]?.name || episode.collections?.[0]?.name || episode.channel?.name || '播客',
    album_id: episode.post?.collections?.[0]?.id || episode.collections?.[0]?.id || episode.channel_id,
    year: new Date(episode.created_at || '').getFullYear() || 0,
    release_date: episode.created_at || '',
    lyrics: episode.post?.content || '',
    audio_url: episode.audio_url,
    cover_url: episodeCover(episode),
    track_number: episode.episode_number,
    status: 'approved',
  });

  const setQueueFromCurrentItems = (items: TimelineItem[]) => {
    const podcastSongs: Song[] = items
      .filter(item => item.type === 'feed_item' && item.feed_item?.enclosure_url)
      .map(item => createPodcastSong(item.feed_item))
      .filter((song): song is Song => Boolean(song));
    queue.value = podcastSongs;
  };

  const setQueueFromPodcastEpisodes = (episodes: PodcastEpisode[]) => {
    queue.value = episodes.map(createPodcastEpisodeSong);
  };

  function syncPodcastProgress(force = false) {
    const song = currentSong.value;
    if (song?.source_type !== 'podcast_episode' || !song.source_id) return;

    const authStore = useAuthStore();
    if (!authStore.token) return;

    const now = Date.now();
    if (!force && now - lastPodcastProgressSyncAt < 15_000) return;
    lastPodcastProgressSyncAt = now;

    const playerDuration = audio?.duration;
    const durationSec = Number.isFinite(playerDuration)
      ? Math.floor(playerDuration || 0)
      : Math.floor(duration.value || 0);

    void fetch(api.podcast.episodeProgress(song.source_id), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({
        position_sec: Math.floor(audio?.currentTime ?? currentTime.value),
        duration_sec: durationSec,
      }),
    }).catch((error) => {
      console.error('Failed to sync podcast progress:', error);
    });
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
    const newTime = Math.max(0, Math.min(audio.currentTime + seconds, duration.value));
    seek(newTime);
  };

  const toggleLyrics = () => {
    showLyrics.value = !showLyrics.value;
    if (showLyrics.value) showQueue.value = false;
  };

  const toggleQueue = () => {
    showQueue.value = !showQueue.value;
    if (showQueue.value) showLyrics.value = false;
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
  };
});
