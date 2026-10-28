import { computed, defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Collection } from '@/types'
import {
  usePostEditorDraftSession,
  type EditorDraftPayload,
  type PostEditorContentSource,
  type PostEditorDraftForm,
  type SaveTarget,
} from '@/composables/blog/usePostEditorDraftSession'

const mockAutoSaveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const mockLastSavedAt = ref<number | null>(null)

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  onBeforeRouteLeave: vi.fn(),
}))

vi.mock('@/composables/useAutoSave', () => ({
  useAutoSave: () => ({
    autoSaveState: mockAutoSaveState,
    lastSavedAt: mockLastSavedAt,
    triggerAutoSave: vi.fn(),
    loadDraft: vi.fn().mockResolvedValue(null),
    clearDraft: vi.fn(),
  }),
}))

const defaultForm: PostEditorDraftForm = {
  title: '',
  content: '',
  summary: '',
  cover_url: '',
  visibility: 'public',
  tags: [],
}

const defaultPayload: EditorDraftPayload = {
  ...defaultForm,
  context_key: 'new',
}

function mountDraftSessionHarness(options?: {
  saving?: ReturnType<typeof ref<SaveTarget | null>>
}) {
  const pinia = createPinia()
  setActivePinia(pinia)

  const isEdit = computed(() => false)
  const draftContextKey = computed(() => 'new')
  const form = ref<PostEditorDraftForm>({ ...defaultForm })
  const draftPayload = computed(() => ({ ...defaultPayload, ...form.value }))
  const contentSource = ref<PostEditorContentSource>('empty')
  const channelCollections = ref<Collection[]>([])
  const selectedCollectionIds = ref<string[]>([])
  const loadedPostUpdatedAt = ref(0)
  const contentReady = ref(true)
  const saving = options?.saving ?? ref<SaveTarget | null>(null)
  const ensureDefaultSelection = vi.fn()
  const getReplaceEditorDocument = vi.fn(() => vi.fn())

  let session!: ReturnType<typeof usePostEditorDraftSession>

  const wrapper = mount(
    defineComponent({
      setup() {
        session = usePostEditorDraftSession({
          isEdit,
          draftContextKey,
          draftPayload,
          form,
          contentSource,
          channelCollections,
          selectedCollectionIds,
          loadedPostUpdatedAt,
          contentReady,
          saving,
          ensureDefaultSelection,
          getReplaceEditorDocument,
        })
        return () => null
      },
    }),
    {
      global: {
        plugins: [pinia],
      },
    },
  )

  return { wrapper, session, saving, form }
}

describe('usePostEditorDraftSession - draftStatus indicator', () => {
  beforeEach(() => {
    mockAutoSaveState.value = 'idle'
    mockLastSavedAt.value = null
  })

  it('shows "自动保存" with muted tone in initial empty state', () => {
    const { session } = mountDraftSessionHarness()
    expect(session.draftStatus.value).toEqual({
      tone: 'muted',
      text: '自动保存',
    })
    expect(session.draftStatus.value.text).not.toContain('开始写作后会自动保存草稿')
  })

  it('shows "发布中…" when publishing post', () => {
    const saving = ref<SaveTarget | null>('published')
    const { session } = mountDraftSessionHarness({ saving })
    expect(session.draftStatus.value).toEqual({
      tone: 'warn',
      text: '发布中…',
    })
  })

  it('shows concise "保存中…" when manual draft save is underway', () => {
    const saving = ref<SaveTarget | null>('draft')
    const { session } = mountDraftSessionHarness({ saving })
    expect(session.draftStatus.value).toEqual({
      tone: 'warn',
      text: '保存中…',
    })
    expect(session.draftStatus.value.text).not.toBe('草稿保存中…')
  })

  it('shows concise "保存中…" when local autosave or cloud sync is active', () => {
    const { session } = mountDraftSessionHarness()

    mockAutoSaveState.value = 'saving'
    expect(session.draftStatus.value).toEqual({
      tone: 'warn',
      text: '保存中…',
    })
    expect(session.draftStatus.value.text).not.toContain('草稿同步中')

    mockAutoSaveState.value = 'idle'
    session.serverDraftState.value = 'syncing'
    expect(session.draftStatus.value).toEqual({
      tone: 'warn',
      text: '保存中…',
    })
  })

  it('shows concise "仅保存在本地" when server draft sync fails and strips verbose explanation', () => {
    const { session } = mountDraftSessionHarness()
    session.serverDraftState.value = 'error'

    expect(session.draftStatus.value).toEqual({
      tone: 'warn',
      text: '仅保存在本地',
    })
    expect(session.draftStatus.value.text).not.toContain('云端草稿同步失败，当前仅保存在本地')
  })

  it('shows concise "保存失败" when local auto save errors out and strips storage troubleshooting text', () => {
    const { session } = mountDraftSessionHarness()
    mockAutoSaveState.value = 'error'

    expect(session.draftStatus.value).toEqual({
      tone: 'warn',
      text: '保存失败',
    })
    expect(session.draftStatus.value.text).not.toContain('请检查浏览器存储权限')
    expect(session.draftStatus.value.text).not.toContain('本地草稿保存失败')
  })

  it('shows concise "检测到未保存草稿" when a deferred candidate is present', () => {
    const { session } = mountDraftSessionHarness()
    session.deferredDraftCandidate.value = {
      source: 'local',
      payload: defaultPayload,
      savedAt: Date.now(),
    }

    expect(session.draftStatus.value).toEqual({
      tone: 'warn',
      text: '检测到未保存草稿',
    })
    expect(session.draftStatus.value.text).not.toBe('检测到可恢复草稿')
  })

  it('shows "已保存 HH:mm" when saved timestamp is available without verbose prefix/labels', () => {
    const { session } = mountDraftSessionHarness()
    const testTime = new Date('2026-10-28T14:30:00').getTime()
    mockLastSavedAt.value = testTime

    const expectedTime = session.formatSavedTime(testTime)
    expect(session.draftStatus.value).toEqual({
      tone: 'ok',
      text: `已保存 ${expectedTime}`,
    })
    expect(session.draftStatus.value.text).not.toContain('草稿已保存 ·')
    expect(session.draftStatus.value.text).not.toContain('本地')
    expect(session.draftStatus.value.text).not.toContain('云端')
  })
})
