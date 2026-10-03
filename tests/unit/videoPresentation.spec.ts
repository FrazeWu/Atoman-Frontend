import { describe, expect, it } from 'vitest'

import { videoAvatarSource, videoThumbnailSource } from '@/utils/videoPresentation'
import type { Video } from '@/types'

describe('video presentation sources', () => {
  it('falls back to the first generated preview when the cover is missing', () => {
    const video = {
      thumbnail_url: ' ',
      preview_thumbnails: [{ time_sec: 0, url: '  /generated/cover.webp  ', width: 160, height: 90 }],
    } as Video

    expect(videoThumbnailSource(video)).toBe('/generated/cover.webp')
  })

  it('prefers the channel cover and then the author avatar', () => {
    const video = {
      channel: { cover_url: ' /channel-cover.webp ' },
      user: { avatar_url: '/author-avatar.webp' },
    } as Video

    expect(videoAvatarSource(video)).toBe('/channel-cover.webp')
    expect(videoAvatarSource({ user: video.user } as Video)).toBe('/author-avatar.webp')
  })
})
