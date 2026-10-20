import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MusicLyricsHeader from '@/components/music/lyrics/MusicLyricsHeader.vue'

describe('MusicLyricsHeader.vue', () => {
  const defaultProps = {
    isReadOnlyAnnotations: false,
    isAnnotationMode: false,
    isPlayerMode: false,
    isPiPSupported: false,
    isPiPActive: false,
    saving: false,
    reverting: false,
  }

  it('renders read-only edit annotations trigger when isReadOnlyAnnotations is true', async () => {
    const wrapper = mount(MusicLyricsHeader, {
      props: {
        ...defaultProps,
        isReadOnlyAnnotations: true,
      },
    })

    const btn = wrapper.find('[data-testid="lyrics-open-song-detail"]')
    expect(btn.exists()).toBe(true)
    expect(wrapper.find('[data-testid="lyrics-annotations-trigger"]').exists()).toBe(false)

    await btn.trigger('click')
    expect(wrapper.emitted('open-song-detail')).toHaveLength(1)
  })

  it('renders toggle annotations trigger when isReadOnlyAnnotations is false', async () => {
    const wrapper = mount(MusicLyricsHeader, {
      props: {
        ...defaultProps,
        isReadOnlyAnnotations: false,
        isAnnotationMode: true,
      },
    })

    const btn = wrapper.get('[data-testid="lyrics-annotations-trigger"]')
    expect(btn.text()).toContain('返回歌词')
    expect(btn.attributes('aria-pressed')).toBe('true')

    await btn.trigger('click')
    expect(wrapper.emitted('toggle-annotation-overview')).toHaveLength(1)
  })

  it('renders version history and lyrics edit triggers in non-player mode', async () => {
    const wrapper = mount(MusicLyricsHeader, {
      props: {
        ...defaultProps,
        isPlayerMode: false,
      },
    })

    const versionsBtn = wrapper.get('[data-testid="lyrics-versions-trigger"]')
    const editBtn = wrapper.get('[data-testid="lyrics-edit-trigger"]')

    await versionsBtn.trigger('click')
    expect(wrapper.emitted('toggle-versions')).toHaveLength(1)

    await editBtn.trigger('click')
    expect(wrapper.emitted('open-editor')).toHaveLength(1)
  })

  it('disables edit button when saving or reverting', () => {
    const wrapper = mount(MusicLyricsHeader, {
      props: {
        ...defaultProps,
        isPlayerMode: false,
        saving: true,
      },
    })

    const editBtn = wrapper.get('[data-testid="lyrics-edit-trigger"]')
    expect(editBtn.attributes('disabled')).toBeDefined()
  })

  it('renders PiP trigger when isPlayerMode and isPiPSupported are true', async () => {
    const wrapper = mount(MusicLyricsHeader, {
      props: {
        ...defaultProps,
        isPlayerMode: true,
        isPiPSupported: true,
        isPiPActive: false,
      },
    })

    const pipBtn = wrapper.get('[data-testid="lyrics-pip-trigger"]')
    expect(pipBtn.text()).toContain('画中画')
    expect(pipBtn.attributes('aria-pressed')).toBe('false')

    await pipBtn.trigger('click')
    expect(wrapper.emitted('toggle-pip')).toHaveLength(1)

    // With active PiP
    await wrapper.setProps({ isPiPActive: true })
    expect(wrapper.get('[data-testid="lyrics-pip-trigger"]').text()).toContain('画中画开')
    expect(wrapper.get('[data-testid="lyrics-pip-trigger"]').attributes('aria-pressed')).toBe('true')
  })

  it('emits close event when clicking close button', async () => {
    const wrapper = mount(MusicLyricsHeader, {
      props: defaultProps,
    })

    const closeBtn = wrapper.get('.music-lyrics-panel__close')
    await closeBtn.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
