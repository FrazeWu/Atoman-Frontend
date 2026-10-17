import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { EditorView } from '@codemirror/view'

vi.mock('y-websocket', () => {
  class MockAwareness {
    clientID = 1
    doc = { clientID: 1 }
    private states = new Map()
    private localState = {}
    on() {}
    off() {}
    getStates() {
      return this.states
    }
    getLocalState() {
      return this.localState
    }
    setLocalStateField() {}
  }
  class WebsocketProvider {
    awareness = new MockAwareness()
    on() {}
    destroy() {}
  }
  return { WebsocketProvider }
})

if (!Range.prototype.getClientRects) {
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [] as unknown as DOMRectList,
  })
}

Object.defineProperty(document, 'compatMode', {
  configurable: true,
  value: 'CSS1Compat',
})

// @ts-expect-error Vitest resolves Vue SFC imports through Vite
import PEditorRuntime from '@/components/shared/PEditorRuntime.vue'
import MediaPickerModal from '@/components/shared/MediaPickerModal.vue'

describe('PEditorEmbedCommands', () => {
  let pinia: ReturnType<typeof createPinia>
  let promptMock: ReturnType<typeof vi.fn>
  const mountedWrappers: VueWrapper[] = []

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    promptMock = vi.fn(() => null)
    Object.defineProperty(window, 'prompt', {
      configurable: true,
      writable: true,
      value: promptMock,
    })
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach((w) => w.unmount())
  })

  async function mountEditor(props: Record<string, unknown> = {}) {
    const wrapper = mount(PEditorRuntime, {
      props: {
        modelValue: '',
        mode: 'split',
        showToolbar: true,
        enableEmbeds: true,
        ...props,
      },
      global: {
        plugins: [pinia],
      },
    })
    mountedWrappers.push(wrapper)
    await nextTick()
    await nextTick()
    return wrapper
  }

  it('renders MediaPickerModal with abovePlayer=true', async () => {
    const wrapper = await mountEditor()
    const modal = wrapper.findComponent(MediaPickerModal)
    expect(modal.exists()).toBe(true)
    expect(modal.props('open')).toBe(false)
    expect(modal.props('abovePlayer')).toBe(true)
  })

  it('opens MediaPickerModal with initialType="song" without calling window.prompt on musicEmbed', async () => {
    const wrapper = await mountEditor()
    ;(wrapper.vm as any).executeCommand('musicEmbed')
    await nextTick()

    expect(promptMock).not.toHaveBeenCalled()
    const modal = wrapper.findComponent(MediaPickerModal)
    expect(modal.props('open')).toBe(true)
    expect(modal.props('initialType')).toBe('song')
  })

  it('opens MediaPickerModal with initialType="video" without calling window.prompt on videoEmbed', async () => {
    const wrapper = await mountEditor()
    ;(wrapper.vm as any).executeCommand('videoEmbed')
    await nextTick()

    expect(promptMock).not.toHaveBeenCalled()
    const modal = wrapper.findComponent(MediaPickerModal)
    expect(modal.props('open')).toBe(true)
    expect(modal.props('initialType')).toBe('video')
  })

  it('inserts :::music{id="..."}::: when a song item is selected', async () => {
    const wrapper = await mountEditor({ modelValue: 'Initial text' })
    ;(wrapper.vm as any).executeCommand('musicEmbed')
    await nextTick()

    const modal = wrapper.findComponent(MediaPickerModal)
    expect(modal.props('open')).toBe(true)

    modal.vm.$emit('select', {
      id: 'song-uuid-001',
      type: 'song',
      title: 'Test Song',
    })
    await nextTick()

    const view = EditorView.findFromDOM(
      wrapper.get('.cm-content').element as HTMLElement
    )!
    expect(view.state.doc.toString()).toContain(':::music{id="song-uuid-001"}:::')
    expect(modal.props('open')).toBe(false)
  })

  it('inserts :::music{id="..."}::: when an album item is selected', async () => {
    const wrapper = await mountEditor({ modelValue: '' })
    ;(wrapper.vm as any).executeCommand('musicEmbed')
    await nextTick()

    const modal = wrapper.findComponent(MediaPickerModal)
    modal.vm.$emit('select', {
      id: 'album-uuid-002',
      type: 'album',
      title: 'Test Album',
    })
    await nextTick()

    const view = EditorView.findFromDOM(
      wrapper.get('.cm-content').element as HTMLElement
    )!
    expect(view.state.doc.toString()).toBe('\n:::music{id="album-uuid-002"}:::\n')
    expect(modal.props('open')).toBe(false)
  })

  it('inserts :::video{id="..."}::: when a video item is selected', async () => {
    const wrapper = await mountEditor({ modelValue: '' })
    ;(wrapper.vm as any).executeCommand('videoEmbed')
    await nextTick()

    const modal = wrapper.findComponent(MediaPickerModal)
    modal.vm.$emit('select', {
      id: 'video-uuid-003',
      type: 'video',
      title: 'Test Video',
    })
    await nextTick()

    const view = EditorView.findFromDOM(
      wrapper.get('.cm-content').element as HTMLElement
    )!
    expect(view.state.doc.toString()).toBe('\n:::video{id="video-uuid-003"}:::\n')
    expect(modal.props('open')).toBe(false)
  })

  it('closes MediaPickerModal when close is emitted', async () => {
    const wrapper = await mountEditor()
    ;(wrapper.vm as any).executeCommand('musicEmbed')
    await nextTick()

    const modal = wrapper.findComponent(MediaPickerModal)
    expect(modal.props('open')).toBe(true)

    modal.vm.$emit('close')
    await nextTick()
    expect(modal.props('open')).toBe(false)
  })

  it('opens picker via toolbar button clicks', async () => {
    const wrapper = await mountEditor({ mode: 'split', showToolbar: true, enableEmbeds: true })
    const buttons = wrapper.findAll('.tb-btn')
    const musicBtn = buttons.find((b) => b.text() === '音乐')!
    expect(musicBtn).toBeDefined()

    await musicBtn.trigger('click')
    await nextTick()

    const modal = wrapper.findComponent(MediaPickerModal)
    expect(modal.props('open')).toBe(true)
    expect(modal.props('initialType')).toBe('song')
    expect(promptMock).not.toHaveBeenCalled()
  })

  it('still uses window.prompt for postEmbed', async () => {
    promptMock.mockReturnValue('article-123')
    const wrapper = await mountEditor({ modelValue: '' })
    ;(wrapper.vm as any).executeCommand('postEmbed')
    await nextTick()

    expect(promptMock).toHaveBeenCalledWith('输入文章 ID')
    const view = EditorView.findFromDOM(
      wrapper.get('.cm-content').element as HTMLElement
    )!
    expect(view.state.doc.toString()).toBe('\n:::post{id="article-123"}:::\n')

    const modal = wrapper.findComponent(MediaPickerModal)
    expect(modal.props('open')).toBe(false)
  })
})
