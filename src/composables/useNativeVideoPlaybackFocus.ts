import { onBeforeUnmount } from 'vue'
import { claimVideoPlayback } from '@/utils/mediaPlaybackFocus'

// An audible native video owns playback until it pauses, becomes muted,
// ends or unmounts. Muted previews do not interrupt the global audio.
export function useNativeVideoPlaybackFocus() {
  let active: HTMLVideoElement | null = null
  let release: (() => void) | undefined
  function clear() {
    active = null
    release?.()
    release = undefined
  }
  function sync(event: Event) {
    const element = event.currentTarget
    if (!(element instanceof HTMLVideoElement)) return
    if (element.paused || element.ended || element.muted || element.volume === 0) {
      if (active === element) clear()
      return
    }
    if (active === element) return
    clear()
    active = element
    release = claimVideoPlayback(() => {
      // clear first because pause may synchronously dispatch an event.
      clear()
      element.pause()
    })
  }
  function stop(event: Event) {
    if (event.currentTarget === active) clear()
  }
  onBeforeUnmount(() => {
    const element = active
    clear()
    element?.pause()
  })
  return {sync,stop}
}
