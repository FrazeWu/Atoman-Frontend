import { mount } from '@vue/test-utils'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, reactive } from 'vue'

const collabMockState = vi.hoisted(() => ({
  initialText: '',
  asyncText: '',
}))

vi.mock('y-websocket', () => {
  class MockAwareness {
    clientID = 1
    doc = { clientID: 1 }
    private states = new Map<number, Record<string, unknown>>()
    private localState: Record<string, unknown> = {}

    on() {}

    getStates() {
      return this.states
    }

    getLocalState() {
      return this.localState
    }

    setLocalStateField(field: string, value: unknown) {
      this.localState = { ...this.localState, [field]: value }
      this.states.set(this.clientID, this.localState)
    }
  }

  class WebsocketProvider {
    awareness = new MockAwareness()
    private syncListeners: Array<(isSynced: boolean) => void> = []

    constructor(_url: string, _roomId: string, doc: { getText: (name: string) => { length: number; insert: (index: number, text: string) => void; delete: (index: number, length: number) => void } }) {
      if (collabMockState.initialText) {
        const text = doc.getText('codemirror')
        if (text.length === 0) {
          text.insert(0, collabMockState.initialText)
        }
      }

      window.setTimeout(() => {
        const text = doc.getText('codemirror')

        if (collabMockState.asyncText) {
          if (text.length > 0) {
            text.delete(0, text.length)
          }
          text.insert(0, collabMockState.asyncText)
        }

        this.syncListeners.forEach((listener) => listener(true))
      }, 0)
    }

    on(event: string, listener: (isSynced: boolean) => void) {
      if (event === 'sync') {
        this.syncListeners.push(listener)
      }
    }

    destroy() {}
  }

  return { WebsocketProvider }
})

import PEditor from '@/components/shared/PEditor.vue'
import {
  resourceReferenceExtension,
  type ResourceReferenceLabels,
} from '@/components/shared/editor/resourceReferenceExtension'

// Task 1 先固定统一编辑器的最小未来契约，后续 Task 2 再让实现对齐这些 props 和语义标识。
const FUTURE_NORMAL_MODE = 'normal'
const FUTURE_SPLIT_MODE = 'split'
const FUTURE_EDITOR_ROOT = '[data-testid="markdown-editor"]'
const FUTURE_SOURCE_SURFACE = '[data-testid="markdown-source"]'
const FUTURE_PREVIEW_PANE = '[data-testid="markdown-preview"]'
const FUTURE_MODE_TOGGLE = '[data-testid="editor-mode-toggle"]'
const ALBUM_ID = '01900000-0000-7000-8000-000000000001'
const ALBUM_REFERENCE = `@album:${ALBUM_ID}`
const DEBATE_ID = '01900000-0000-7000-8000-000000000002'
const DEBATE_REFERENCE = `@debate:${DEBATE_ID}:support`

async function flushCollabSync() {
  vi.useFakeTimers()
  await vi.runAllTimersAsync()
  await nextTick()
  vi.useRealTimers()
}

async function mountEditor(props: Record<string, unknown>) {
  const wrapper = mount(PEditor, { props })
  await vi.dynamicImportSettled()
  await nextTick()
  return wrapper
}

describe('PEditor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    collabMockState.initialText = ''
    collabMockState.asyncText = ''
  })

  it('renders CodeMirror editor in normal mode without preview pane', async () => {
    const wrapper = await mountEditor({
      modelValue: 'hello',
      mode: FUTURE_NORMAL_MODE,
    })

    expect(wrapper.find('.cm-editor').exists()).toBe(true)
    expect(wrapper.find(FUTURE_PREVIEW_PANE).exists()).toBe(false)
  })

  it('renders preview pane in split mode', async () => {
    const wrapper = await mountEditor({
      modelValue: '# title',
      mode: FUTURE_SPLIT_MODE,
    })

    expect(wrapper.find(`${FUTURE_EDITOR_ROOT}[data-editor-mode="${FUTURE_SPLIT_MODE}"]`).exists()).toBe(true)
    expect(wrapper.find(FUTURE_SOURCE_SURFACE).exists()).toBe(true)
    expect(wrapper.find(FUTURE_PREVIEW_PANE).exists()).toBe(true)
  })

  it('shows mode toggle when enabled', async () => {
    const wrapper = await mountEditor({
      modelValue: '',
      mode: FUTURE_NORMAL_MODE,
      showModeToggle: true,
    })

    expect(wrapper.find(FUTURE_MODE_TOGGLE).exists()).toBe(true)
  })

  it('syncs external modelValue into CodeMirror in normal mode', async () => {
    const wrapper = await mountEditor({
      modelValue: 'hello',
      mode: FUTURE_NORMAL_MODE,
    })

    await wrapper.setProps({ modelValue: 'synced from parent' })
    await nextTick()

    expect(wrapper.find('.cm-content').text()).toContain('synced from parent')
  })

  it('emits update:modelValue when replaceDocument is called in normal mode', async () => {
    const wrapper = await mountEditor({
      modelValue: 'hello',
      mode: FUTURE_NORMAL_MODE,
    })

    wrapper.vm.replaceDocument('replaced from api')
    await nextTick()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['replaced from api'])
    expect(wrapper.find('.cm-content').text()).toContain('replaced from api')
  })

  it('forces collab sessions to use split mode with preview pane', async () => {
    const wrapper = await mountEditor({
      modelValue: 'hello',
      mode: FUTURE_NORMAL_MODE,
      enableCollab: true,
      collabRoomId: 'room-1',
    })
    await flushCollabSync()

    expect(wrapper.attributes('data-editor-mode')).toBe(FUTURE_SPLIT_MODE)
    expect(wrapper.find('.cm-editor').exists()).toBe(true)
    expect(wrapper.find(FUTURE_PREVIEW_PANE).exists()).toBe(true)
  })

  it('does not expose a misleading mode toggle in collab mode', async () => {
    const wrapper = await mountEditor({
      modelValue: 'hello',
      mode: FUTURE_NORMAL_MODE,
      showModeToggle: true,
      enableCollab: true,
      collabRoomId: 'room-1',
    })
    await flushCollabSync()

    expect(wrapper.find(FUTURE_EDITOR_ROOT).find(FUTURE_MODE_TOGGLE).exists()).toBe(false)
    expect(wrapper.find(FUTURE_MODE_TOGGLE).exists()).toBe(false)
    expect(wrapper.emitted('mode-change')).toBeUndefined()
  })

  it('renders sync scroll toggle in split mode when enabled', async () => {
    const wrapper = await mountEditor({
      modelValue: '# hello',
      mode: FUTURE_SPLIT_MODE,
      showSyncScrollToggle: true,
      syncScroll: true,
    })

    const syncToggle = wrapper.find('[data-testid="editor-sync-scroll-toggle"]')
    expect(syncToggle.exists()).toBe(true)
    expect(syncToggle.text()).toContain('跟随滚动')
  })

  it('updates mode toggle active state and label with current mode', async () => {
    const wrapper = await mountEditor({
      modelValue: '',
      mode: FUTURE_NORMAL_MODE,
      showModeToggle: true,
    })

    const modeToggle = wrapper.find(FUTURE_MODE_TOGGLE)
    expect(modeToggle.classes()).not.toContain('active')
    expect(modeToggle.attributes('aria-pressed')).toBe('false')
    expect(modeToggle.text()).toContain('关')

    await wrapper.setProps({ mode: FUTURE_SPLIT_MODE })
    await nextTick()

    expect(modeToggle.classes()).toContain('active')
    expect(modeToggle.attributes('aria-pressed')).toBe('true')
    expect(modeToggle.text()).toContain('开')
  })

  it('updates sync scroll toggle active state and label with syncScroll value', async () => {
    const wrapper = await mountEditor({
      modelValue: '# hello',
      mode: FUTURE_SPLIT_MODE,
      showSyncScrollToggle: true,
      syncScroll: false,
    })

    const syncToggle = wrapper.find('[data-testid="editor-sync-scroll-toggle"]')
    expect(syncToggle.classes()).not.toContain('active')
    expect(syncToggle.attributes('aria-pressed')).toBe('false')
    expect(syncToggle.text()).toContain('关')

    await wrapper.setProps({ syncScroll: true })
    await nextTick()

    expect(syncToggle.classes()).toContain('active')
    expect(syncToggle.attributes('aria-pressed')).toBe('true')
    expect(syncToggle.text()).toContain('开')
  })

  it('seeds an empty collab document from modelValue on first mount', async () => {
    const wrapper = await mountEditor({
      modelValue: 'hello collab',
      mode: FUTURE_SPLIT_MODE,
      enableCollab: true,
      collabRoomId: 'room-1',
    })
    await flushCollabSync()

    expect(wrapper.find('.cm-content').text()).toContain('hello collab')
  })

  it('does not overwrite existing collab document content with modelValue', async () => {
    collabMockState.initialText = 'shared copy'

    const wrapper = await mountEditor({
      modelValue: 'local draft',
      mode: FUTURE_SPLIT_MODE,
      enableCollab: true,
      collabRoomId: 'room-1',
    })
    await flushCollabSync()

    expect(wrapper.find('.cm-content').text()).toContain('shared copy')
    expect(wrapper.find('.cm-content').text()).not.toContain('local draft')
  })

  it('emits collab-ready only after async shared content becomes readable', async () => {
    collabMockState.asyncText = 'shared async copy'

    const wrapper = await mountEditor({
      modelValue: 'hello collab',
      mode: FUTURE_SPLIT_MODE,
      enableCollab: true,
      collabRoomId: 'room-1',
    })

    expect(wrapper.emitted('collab-ready')).toBeUndefined()

    await flushCollabSync()

    expect(wrapper.emitted('collab-ready')).toEqual([['shared async copy']])
    expect(wrapper.find('.cm-content').text()).toContain('shared async copy')
    expect(wrapper.find('.cm-content').text()).not.toContain('hello collab')
  })

  it('emits collab-ready with existing shared content instead of local modelValue', async () => {
    collabMockState.initialText = 'shared copy'

    const wrapper = await mountEditor({
      modelValue: 'local draft',
      mode: FUTURE_SPLIT_MODE,
      enableCollab: true,
      collabRoomId: 'room-1',
    })
    expect(wrapper.emitted('collab-ready')).toBeUndefined()

    await flushCollabSync()

    expect(wrapper.emitted('collab-ready')).toEqual([['shared copy']])
  })

  it('emits collab-ready only once after collab content becomes readable', async () => {
    collabMockState.initialText = 'shared copy'

    const wrapper = await mountEditor({
      modelValue: 'local draft',
      mode: FUTURE_SPLIT_MODE,
      enableCollab: true,
      collabRoomId: 'room-1',
    })
    await flushCollabSync()
    await flushCollabSync()

    expect(wrapper.emitted('collab-ready')).toEqual([['shared copy']])
  })

  it('replaces the whole document when replaceDocument is called', async () => {
    const wrapper = await mountEditor({
      modelValue: 'hello collab',
      mode: FUTURE_SPLIT_MODE,
      enableCollab: true,
      collabRoomId: 'room-1',
    })
    await flushCollabSync()

    expect(wrapper.find('.cm-content').text()).toContain('hello collab')

    wrapper.vm.replaceDocument('restored draft')
    await nextTick()

    expect(wrapper.find('.cm-content').text()).toContain('restored draft')
    expect(wrapper.find('.cm-content').text()).not.toContain('hello collab')
  })

  it('clears the whole document when replaceDocument is called with an empty string', async () => {
    const wrapper = await mountEditor({
      modelValue: 'hello collab',
      mode: FUTURE_SPLIT_MODE,
      enableCollab: true,
      collabRoomId: 'room-1',
    })
    await flushCollabSync()

    expect(wrapper.find('.cm-content').text()).toContain('hello collab')

    wrapper.vm.replaceDocument('')
    await nextTick()

    expect(wrapper.find('.cm-placeholder').text()).toBe('开始输入…')
    expect(wrapper.find('.cm-content').text()).not.toContain('hello collab')

    wrapper.vm.replaceDocument('restored draft')
    await nextTick()

    expect(wrapper.find('.cm-content').text()).toContain('restored draft')
  })

  it('renders without error with renderingLevel comment', async () => {
    const wrapper = await mountEditor({
      modelValue: '**bold** and _italic_',
      mode: FUTURE_NORMAL_MODE,
      renderingLevel: 'comment',
    })
    expect(wrapper.find(FUTURE_EDITOR_ROOT).exists()).toBe(true)
    expect(wrapper.find('.cm-content').exists()).toBe(true)
  })

  it('开启后把已解析资源显示为行内引用块且保留原始源码', async () => {
    const wrapper = await mountEditor({
      modelValue: ALBUM_REFERENCE,
      mode: FUTURE_NORMAL_MODE,
      enableResourceReferences: true,
      resourceReferenceLabels: {
        [`album:${ALBUM_ID}`]: { title: 'Kind of Blue' },
      },
    })

    const reference = wrapper.get(`[data-resource-reference="album:${ALBUM_ID}"]`)
    const view = EditorView.findFromDOM(wrapper.get('.cm-content').element as HTMLElement)
    expect(reference.text()).toContain('Kind of Blue')
    expect(reference.text()).toContain('专辑')
    expect(reference.attributes('data-resource-reference-state')).toBe('active')
    expect(view?.state.doc.toString()).toBe(ALBUM_REFERENCE)

    wrapper.vm.replaceDocument(`${ALBUM_REFERENCE}\n补充说明`)
    await nextTick()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([`${ALBUM_REFERENCE}\n补充说明`])
    expect(view?.state.doc.toString()).toBe(`${ALBUM_REFERENCE}\n补充说明`)
  })

  it('光标进入引用范围时恢复原始标记', async () => {
    const prefix = '证据：'
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = new EditorView({
      state: EditorState.create({
        doc: `${prefix}${ALBUM_REFERENCE}`,
        extensions: [resourceReferenceExtension({
          [`album:${ALBUM_ID}`]: { title: 'Kind of Blue' },
        })],
      }),
      parent,
    })
    expect(parent.querySelector(`[data-resource-reference="album:${ALBUM_ID}"]`)).not.toBeNull()

    view.focus()
    view.dispatch({ selection: { anchor: prefix.length + 2 } })
    await nextTick()

    expect(parent.querySelector(`[data-resource-reference="album:${ALBUM_ID}"]`)).toBeNull()
    expect(view.contentDOM.textContent).toContain(ALBUM_REFERENCE)
    expect(view.state.doc.toString()).toBe(`${prefix}${ALBUM_REFERENCE}`)
    view.destroy()
    parent.remove()
  })

  it('labels 更新时原地刷新引用标题和状态', async () => {
    const key = `album:${ALBUM_ID}`
    const wrapper = await mountEditor({
      modelValue: ALBUM_REFERENCE,
      mode: FUTURE_NORMAL_MODE,
      enableResourceReferences: true,
      resourceReferenceLabels: {
        [key]: { title: '旧标题' },
      },
    })
    const originalView = EditorView.findFromDOM(wrapper.get('.cm-content').element as HTMLElement)

    await wrapper.setProps({
      resourceReferenceLabels: {
        [key]: { title: '新标题', state: 'stale' },
      },
    })
    await nextTick()

    const reference = wrapper.get(`[data-resource-reference="${key}"]`)
    expect(reference.text()).toContain('新标题')
    expect(reference.text()).toContain('待确认')
    expect(reference.classes()).toContain('resource-reference--stale')
    expect(reference.attributes('data-resource-reference-state')).toBe('stale')
    expect(EditorView.findFromDOM(wrapper.get('.cm-content').element as HTMLElement)).toBe(originalView)
  })

  it('labels 深层原地修改时刷新现有引用块', async () => {
    const key = `debate:${DEBATE_ID}`
    const labels = reactive<ResourceReferenceLabels>({
      [key]: {
        title: '旧辩题',
        state: 'active',
        qualifierLabel: '赞成',
      },
    })
    const wrapper = await mountEditor({
      modelValue: DEBATE_REFERENCE,
      mode: FUTURE_NORMAL_MODE,
      enableResourceReferences: true,
      resourceReferenceLabels: labels,
    })
    const originalView = EditorView.findFromDOM(wrapper.get('.cm-content').element as HTMLElement)

    labels[key].title = '新辩题'
    labels[key].state = 'stale'
    labels[key].qualifierLabel = '支撑'
    await nextTick()

    const reference = wrapper.get(`[data-resource-reference="${key}"]`)
    expect(reference.text()).toContain('新辩题')
    expect(reference.text()).toContain('支撑')
    expect(reference.text()).toContain('待确认')
    expect(reference.classes()).toContain('resource-reference--stale')
    expect(reference.attributes('data-resource-reference-state')).toBe('stale')
    expect(EditorView.findFromDOM(wrapper.get('.cm-content').element as HTMLElement)).toBe(originalView)
  })

  it('默认关闭资源引用装饰', async () => {
    const wrapper = await mountEditor({
      modelValue: ALBUM_REFERENCE,
      mode: FUTURE_NORMAL_MODE,
      resourceReferenceLabels: {
        [`album:${ALBUM_ID}`]: { title: 'Kind of Blue' },
      },
    })

    expect(wrapper.find(`[data-resource-reference="album:${ALBUM_ID}"]`).exists()).toBe(false)
    expect(wrapper.get('.cm-content').text()).toContain(ALBUM_REFERENCE)
  })

  it('把可访问名称绑定到真实 CodeMirror textbox', async () => {
    const wrapper = await mountEditor({
      modelValue: '',
      mode: FUTURE_NORMAL_MODE,
      editorAriaLabel: '辩题正文',
    })

    expect(wrapper.get('.cm-content[role="textbox"]').attributes('aria-label')).toBe('辩题正文')
  })
})
