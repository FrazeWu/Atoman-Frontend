import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import AppleMusicPreview from '@/components/music/AppleMusicPreview.vue'
import { getMusicAppleSongPreview } from '@/api/musicV1'

vi.mock('@/api/musicV1', () => ({
  getMusicAppleSongPreview: vi.fn(),
}))

describe('AppleMusicPreview', () => {
  beforeEach(() => {
    vi.mocked(getMusicAppleSongPreview).mockResolvedValue({
      preview_url: 'https://audio-ssl.itunes.apple.com/preview.m4a',
      store_url: 'https://music.apple.com/cn/song/example/123',
      attribution: '试听由 iTunes 提供',
      max_duration_seconds: 30,
    })
  })

  it('使用独立音频元素试听，并在 30 秒时截断', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    const wrapper = mount(AppleMusicPreview, {
      props: { songId: 'song-1', storeUrl: 'https://music.apple.com/cn/song/example/123' },
    })
    await flushPromises()

    expect(getMusicAppleSongPreview).toHaveBeenCalledWith('song-1', expect.any(AbortSignal))
    const audio = wrapper.get('audio')
    expect(audio.attributes('preload')).toBe('none')
    expect(wrapper.text()).toContain('试听由 iTunes 提供')
    expect(wrapper.get('[data-testid="apple-music-badge"]').attributes('href')).toContain('music.apple.com')

    await wrapper.get('[data-testid="apple-preview-toggle"]').trigger('click')
    expect(play).toHaveBeenCalledOnce()

    Object.defineProperty(audio.element, 'currentTime', { configurable: true, writable: true, value: 30 })
    await audio.trigger('timeupdate')
    expect(pause).toHaveBeenCalled()
    expect(audio.element.currentTime).toBe(0)

    wrapper.unmount()
    expect(load).toHaveBeenCalled()
    expect(audio.attributes('src')).toBeUndefined()
  })

  it('没有试听地址时只保留 Apple Music 官方跳转', async () => {
    vi.mocked(getMusicAppleSongPreview).mockResolvedValue({
      store_url: 'https://music.apple.com/cn/song/example/123',
      attribution: '试听由 iTunes 提供',
      max_duration_seconds: 30,
    })
    const wrapper = mount(AppleMusicPreview, {
      props: { songId: 'song-1', storeUrl: 'https://music.apple.com/cn/song/example/123' },
    })
    await flushPromises()

    expect(wrapper.find('audio').exists()).toBe(false)
    expect(wrapper.find('[data-testid="apple-preview-toggle"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="apple-music-badge"]').attributes('href')).toContain('music.apple.com')
  })

  it('只在无本地音频的 Apple 来源歌曲详情中接入', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/music/SongDrawer.vue'), 'utf8')
    expect(source).toContain('<AppleMusicPreview')
    expect(source).toContain('v-if="appleMusicSource?.url && !detail.playable"')
    expect(source).not.toContain('player.playSong(preview')
  })
})
