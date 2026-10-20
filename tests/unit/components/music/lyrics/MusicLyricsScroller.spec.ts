import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MusicLyricsScroller from '@/components/music/lyrics/MusicLyricsScroller.vue'

vi.mock('@/components/music/MusicLyricsLine.vue', () => ({
  default: {
    props: ['line', 'annotations', 'active', 'bilingual', 'canSelect', 'canAnnotate', 'clickToSeek'],
    template: `
      <div
        class="music-lyrics-line"
        :class="{ 'is-active': active }"
        :data-line-id="line.line_key ?? line.id"
      >
        <span>{{ line.text }}</span>
        <button type="button" class="select-text" @click="$emit('select-text', { line, selectedText: 'text' })">选中文本</button>
        <button type="button" class="open-annotations" @click="$emit('open-annotations', { line, annotationIds: [] })">打开注释</button>
        <button type="button" class="seek" @click="$emit('seek', 10)">定位</button>
      </div>
    `,
  },
}))

vi.mock('@/components/ui/PSegmentedControl.vue', () => ({
  default: {
    props: ['modelValue', 'options'],
    template: `
      <div class="segmented-control-stub">
        <button v-for="opt in options" :key="opt.value" :data-value="opt.value" @click="$emit('update:modelValue', opt.value)">
          {{ opt.label }}
        </button>
      </div>
    `,
  },
}))

describe('MusicLyricsScroller.vue', () => {
  const defaultProps = {
    songTitle: 'Test Song',
    creditGroups: [
      { role: 'primary', label: '艺术家', names: ['Test Artist'] },
    ],
    activeAnnotationCount: 5,
    lyrics: {
      lines: [
        { line_key: 'line-1', text: 'Line 1', time_ms: 0 },
        { line_key: 'line-2', text: 'Line 2', time_ms: 5000 },
      ],
    },
    loading: false,
    annotationsByLine: new Map(),
    currentLineId: 'line-1',
    isPlayerMode: true,
    isAnnotationMode: false,
    isAuthenticated: true,
    hasTranslation: false,
    displayMode: 'bilingual' as const,
  }

  it('renders song title, credits and annotation count', () => {
    const wrapper = mount(MusicLyricsScroller, {
      props: defaultProps,
    })

    expect(wrapper.get('.music-lyrics-panel__eyebrow').text()).toContain('5 条注释')
    expect(wrapper.get('.music-lyrics-panel__song-info h2').text()).toBe('Test Song')
    expect(wrapper.get('.music-lyrics-panel__credits').text()).toContain('艺术家')
    expect(wrapper.get('.music-lyrics-panel__credits').text()).toContain('Test Artist')
  })

  it('renders translation segmented control when hasTranslation is true', async () => {
    const wrapper = mount(MusicLyricsScroller, {
      props: {
        ...defaultProps,
        hasTranslation: true,
      },
    })

    const originalBtn = wrapper.get('[data-value="original"]')
    await originalBtn.trigger('click')
    expect(wrapper.emitted('update:displayMode')).toEqual([['original']])
  })

  it('renders loading and empty placeholders correctly', async () => {
    const wrapper = mount(MusicLyricsScroller, {
      props: {
        ...defaultProps,
        loading: true,
      },
    })
    expect(wrapper.text()).toContain('加载中')

    await wrapper.setProps({ loading: false, lyrics: { lines: [] } })
    expect(wrapper.text()).toContain('暂无歌词')
  })

  it('renders lyrics lines and forwards events', async () => {
    const wrapper = mount(MusicLyricsScroller, {
      props: defaultProps,
    })

    const lines = wrapper.findAll('.music-lyrics-line')
    expect(lines).toHaveLength(2)
    expect(lines[0].classes()).toContain('is-active')

    await wrapper.get('.select-text').trigger('click')
    expect(wrapper.emitted('select-text')).toHaveLength(1)

    await wrapper.get('.open-annotations').trigger('click')
    expect(wrapper.emitted('open-annotations')).toHaveLength(1)

    await wrapper.get('.seek').trigger('click')
    expect(wrapper.emitted('seek')).toEqual([[10]])
  })

  it('locks auto-scroll on user wheel and touch interaction', async () => {
    vi.useFakeTimers()
    const wrapper = mount(MusicLyricsScroller, {
      props: defaultProps,
    })

    const linesContainer = wrapper.get('.music-lyrics-panel__lines')
    await linesContainer.trigger('wheel')

    const scrollIntoView = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView

    // During the 2500ms lock, scroll to active line should be suppressed
    wrapper.vm.scrollToActiveLine()
    expect(scrollIntoView).not.toHaveBeenCalled()

    // Fast-forward past lock timer
    vi.advanceTimersByTime(2500)

    wrapper.vm.scrollToActiveLine()
    expect(scrollIntoView).toHaveBeenCalled()
    vi.useRealTimers()
  })
})
