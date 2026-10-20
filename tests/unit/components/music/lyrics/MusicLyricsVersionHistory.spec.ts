import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MusicLyricsVersionHistory from '@/components/music/lyrics/MusicLyricsVersionHistory.vue'

describe('MusicLyricsVersionHistory.vue', () => {
  const defaultProps = {
    versions: [],
    versionsLoading: false,
    versionsErrorMessage: '',
    versionsSongId: 'song-1',
    songId: 'song-1',
    selectedVersionPreview: null,
    saving: false,
    reverting: false,
  }

  it('renders loading placeholder when versionsLoading is true', () => {
    const wrapper = mount(MusicLyricsVersionHistory, {
      props: {
        ...defaultProps,
        versionsLoading: true,
      },
    })
    expect(wrapper.text()).toContain('正在加载版本')
  })

  it('renders error placeholder when versionsErrorMessage is set', () => {
    const wrapper = mount(MusicLyricsVersionHistory, {
      props: {
        ...defaultProps,
        versionsErrorMessage: '获取版本历史失败',
      },
    })
    expect(wrapper.text()).toContain('获取版本历史失败')
  })

  it('renders empty placeholder when songId does not match or versions is empty', () => {
    const wrapper = mount(MusicLyricsVersionHistory, {
      props: {
        ...defaultProps,
        versionsSongId: 'song-2',
        versions: [{ version: 1, edit_summary: 'initial' }],
      },
    })
    expect(wrapper.text()).toContain('暂无版本')
  })

  it('renders version list when versions are available', async () => {
    const wrapper = mount(MusicLyricsVersionHistory, {
      props: {
        ...defaultProps,
        versions: [
          { version: 2, edit_summary: '修正翻译' },
          { version: 1, edit_summary: '初始版本' },
        ],
      },
    })

    expect(wrapper.text()).toContain('第 2 版')
    expect(wrapper.text()).toContain('修正翻译')
    expect(wrapper.text()).toContain('第 1 版')
    expect(wrapper.text()).toContain('初始版本')

    const previewBtn = wrapper.get('[data-testid="lyrics-version-preview-2"]')
    await previewBtn.trigger('click')
    expect(wrapper.emitted('select-preview')).toEqual([[2]])
  })

  it('renders version diff preview and handles revert action', async () => {
    const wrapper = mount(MusicLyricsVersionHistory, {
      props: {
        ...defaultProps,
        versions: [
          { version: 2, edit_summary: '修正翻译' },
        ],
        selectedVersionPreview: {
          version: 2,
          affectedActiveAnnotationCount: 3,
          lines: [
            { kind: 'unchanged', current: { text: 'Line 1' } },
            { kind: 'modified', current: { text: 'Old Line', translation: '原译' }, target: { text: 'Old Line', translation: '新译' } },
            { kind: 'added', target: { text: 'New Line' } },
          ],
        },
      },
    })

    expect(wrapper.find('[data-testid="lyrics-version-diff-2"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('3 条注释需重新绑定')
    expect(wrapper.text()).toContain('当前译文：原译')
    expect(wrapper.text()).toContain('目标译文：新译')
    expect(wrapper.text()).toContain('新增')

    const revertBtn = wrapper.get('[data-testid="lyrics-revert-version-2"]')
    expect(revertBtn.attributes('disabled')).toBeUndefined()
    await revertBtn.trigger('click')
    expect(wrapper.emitted('revert')).toEqual([[2]])

    // Disables button when saving or reverting
    await wrapper.setProps({ saving: true })
    expect(wrapper.get('[data-testid="lyrics-revert-version-2"]').attributes('disabled')).toBeDefined()
  })
})
