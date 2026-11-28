// A single focus owner for the site's own audio and video surfaces. Cross-origin
// iframes do not reliably expose playback state, so their lifetime is the lease.
type Stop = () => void
type Lease = {stop: Stop}
let musicPause: Stop | undefined
let video: Lease | undefined

export function registerMusicPause(pause: Stop): Stop {
  musicPause = pause
  return () => { if (musicPause === pause) musicPause = undefined }
}

export function claimMusicPlayback() {
  const previous = video
  video = undefined
  previous?.stop()
}

export function claimVideoPlayback(stop: Stop): Stop {
  const previous = video
  const lease = {stop}
  video = lease
  previous?.stop()
  musicPause?.()
  return () => { if (video === lease) video = undefined }
}
