import { onBeforeUnmount } from 'vue'

export type AudioSyncMessage = 
  | { type: 'PLAY_REQUEST', tabId: string }

export function useAudioPlayerSync() {
  const channelName = 'atoman_audio_sync'
  let channel: BroadcastChannel | null = null
  const tabId = Math.random().toString(36).substring(2, 9)

  const callbacks = {
    onForeignPlayRequest: () => {},
  }

  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel(channelName)
    channel.onmessage = (event) => {
      const msg = event.data as AudioSyncMessage
      if (msg.tabId === tabId) return
      
      if (msg.type === 'PLAY_REQUEST') {
        callbacks.onForeignPlayRequest()
      }
    }
  }

  const broadcastPlayRequest = () => {
    if (channel) {
      channel.postMessage({ type: 'PLAY_REQUEST', tabId })
    }
  }

  const setForeignPlayRequestCallback = (cb: () => void) => {
    callbacks.onForeignPlayRequest = cb
  }

  // Media Session API Support
  const setupMediaSession = (handlers: {
    play: () => void,
    pause: () => void,
    previoustrack: () => void,
    nexttrack: () => void,
    seekto: (details: MediaSessionActionDetails) => void,
  }) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', handlers.play)
      navigator.mediaSession.setActionHandler('pause', handlers.pause)
      navigator.mediaSession.setActionHandler('previoustrack', handlers.previoustrack)
      navigator.mediaSession.setActionHandler('nexttrack', handlers.nexttrack)
      navigator.mediaSession.setActionHandler('seekto', handlers.seekto)
    }
  }

  const updateMediaSessionMetadata = (metadata: {
    title: string,
    artist: string,
    album: string,
    artworkUrl: string
  }) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        artwork: metadata.artworkUrl ? [
          { src: metadata.artworkUrl, sizes: '512x512', type: 'image/jpeg' }
        ] : []
      })
    }
  }
  
  const updateMediaSessionPosition = (state: { duration: number, playbackRate: number, position: number }) => {
    if ('mediaSession' in navigator && navigator.mediaSession.setPositionState) {
        if (state.duration > 0 && state.position >= 0 && state.position <= state.duration) {
            navigator.mediaSession.setPositionState({
                duration: state.duration,
                playbackRate: state.playbackRate,
                position: state.position,
            })
        } else {
            navigator.mediaSession.setPositionState(undefined)
        }
    }
  }

  onBeforeUnmount(() => {
    if (channel) {
      channel.close()
    }
  })

  return {
    broadcastPlayRequest,
    setForeignPlayRequestCallback,
    setupMediaSession,
    updateMediaSessionMetadata,
    updateMediaSessionPosition
  }
}
