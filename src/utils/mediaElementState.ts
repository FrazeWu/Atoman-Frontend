export const mediaElementEvents: Array<keyof HTMLMediaElementEventMap> = [
  'canplay',
  'durationchange',
  'emptied',
  'ended',
  'error',
  'loadeddata',
  'loadedmetadata',
  'loadstart',
  'pause',
  'playing',
  'progress',
  'ratechange',
  'seeked',
  'seeking',
  'timeupdate',
  'volumechange',
  'waiting',
]

export function subscribeToMediaElement(media: HTMLMediaElement, listener: EventListener) {
  for (const eventName of mediaElementEvents) media.addEventListener(eventName, listener)
  return () => {
    for (const eventName of mediaElementEvents) media.removeEventListener(eventName, listener)
  }
}
