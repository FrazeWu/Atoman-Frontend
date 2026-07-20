import { computed, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiErrorResponseError } from '@/api/client'

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  createAnnotation: vi.fn(),
  updateAnnotation: vi.fn(),
  deleteAnnotation: vi.fn(),
  voteAnnotation: vi.fn(),
  loadVersions: vi.fn(),
  resetVersions: vi.fn(),
  revertVersion: vi.fn(),
  currentLine: vi.fn(),
  removePendingMusicLyricsAnnotation: vi.fn(),
}))

const apiMocks = vi.hoisted(() => ({
  getMusicSongLyrics: vi.fn(),
}))

const authState = vi.hoisted(() => ({
  isAuthenticated: true,
  user: null as null | { id?: number | string; uuid?: string; username: string; email: string },
}))

const lyricsState = {
  lyrics: ref<any>(null),
  loading: ref(false),
  saving: ref(false),
  reverting: ref(false),
  errorMessage: ref(''),
  versionsErrorMessage: ref(''),
  versions: ref<any[]>([]),
  versionsSongId: ref('song-1'),
  versionsLoading: ref(false),
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const annotationsByLine = computed<Map<string, any[]>>(() => {
  const index = new Map<string, any[]>()
  for (const annotation of lyricsState.lyrics.value?.annotations ?? []) {
    const lineAnnotations = index.get(annotation.line_key) ?? []
    lineAnnotations.push(annotation)
    index.set(annotation.line_key, lineAnnotations)
  }
  return index
})

vi.mock('@/composables/useMusicLyrics', () => ({
  useMusicLyrics: () => ({
    ...lyricsState,
    annotationsByLine,
    load: mocks.load,
    save: mocks.save,
    createAnnotation: mocks.createAnnotation,
    updateAnnotation: mocks.updateAnnotation,
    deleteAnnotation: mocks.deleteAnnotation,
    voteAnnotation: mocks.voteAnnotation,
    versions: lyricsState.versions,
    versionsSongId: lyricsState.versionsSongId,
    versionsLoading: lyricsState.versionsLoading,
    loadVersions: mocks.loadVersions,
    resetVersions: mocks.resetVersions,
    revertVersion: mocks.revertVersion,
    currentLine: mocks.currentLine,
  }),
}))

vi.mock('@/api/musicV1', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/musicV1')>()

  return {
    ...actual,
    getMusicSongLyrics: apiMocks.getMusicSongLyrics,
  }
})

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authState,
}))

vi.mock('@/composables/usePendingMusicLyricsAnnotations', () => ({
  removePendingMusicLyricsAnnotation: mocks.removePendingMusicLyricsAnnotation,
}))

vi.mock('@/components/music/MusicLyricsLine.vue', () => ({
  default: {
    props: ['line', 'annotations', 'active', 'bilingual', 'canSelect'],
    template: `
      <div
        class="lyrics-line-stub music-lyrics-line"
        :class="{ 'is-active': active }"
        :data-line-id="line.line_key ?? line.id"
        :data-active="String(active)"
        :data-annotation-count="annotations.length"
        :data-bilingual="String(bilingual)"
        :data-can-select="String(canSelect)"
      >
        <span>{{ line.text }}</span>
        <button type="button" class="open-annotations" @click="$emit('open-annotations', { line, annotationIds: annotations.map((item) => item.id) })">
          打开注释
        </button>
        <button type="button" class="select-text" @click="$emit('select-text', { line, selectedText: 'Neon', startOffset: 0, endOffset: 4 })">
          选中文本
        </button>
      </div>
    `,
  },
}))

vi.mock('@/components/music/MusicAnnotationEditor.vue', () => ({
  default: {
    props: ['show', 'selectedText', 'initialBody', 'mode'],
    template: `
      <div v-if="show" class="annotation-editor-stub">
        <span class="annotation-editor-mode">{{ mode }}</span>
        <span class="annotation-editor-selected">{{ selectedText }}</span>
        <span class="annotation-editor-body">{{ initialBody }}</span>
        <button type="button" class="annotation-save" @click="$emit('save', '新的注释')">保存注释</button>
        <button type="button" class="annotation-cancel" @click="$emit('cancel')">取消注释</button>
        <button type="button" class="annotation-confirm-rebind" @click="$emit('confirm-rebind')">确认重新绑定</button>
      </div>
    `,
  },
}))

vi.mock('@/components/music/MusicLyricEditorDrawer.vue', () => ({
  default: {
    props: ['show', 'songTitle', 'content', 'translation', 'format', 'saving', 'currentTimeSeconds'],
    data() {
      return { draftContent: '' }
    },
    watch: {
      show: {
        immediate: true,
        handler(show: boolean) {
          if (show) this.draftContent = this.content
        },
      },
    },
    template: `
      <div
        v-if="show"
        class="lyric-editor-drawer-stub"
        :data-song-title="songTitle"
        :data-current-time-seconds="currentTimeSeconds"
      >
        <span class="drawer-content">{{ draftContent }}</span>
        <input v-model="draftContent" class="drawer-content-input" />
        <span class="drawer-translation">{{ translation }}</span>
        <span class="drawer-format">{{ format }}</span>
        <button type="button" class="drawer-save" @click="$emit('save', { content: draftContent, translation: 'New translation', format: 'plain', editSummary: '修正歌词' })">
          保存歌词
        </button>
        <button type="button" class="drawer-close" @click="$emit('close')">关闭抽屉</button>
        <button type="button" class="drawer-seek" @click="$emit('seek', 19.625)">定位</button>
      </div>
    `,
  },
}))

vi.mock('@/components/ui/PSegmentedControl.vue', () => ({
  default: {
    props: ['modelValue', 'options'],
    template: `
      <div class="lyrics-mode-stub" :data-model="modelValue">
        <button v-for="option in options" :key="option.value" :data-mode="option.value" @click="$emit('update:modelValue', option.value)">
          {{ option.label }}
        </button>
      </div>
    `,
  },
}))

vi.mock('@/components/ui/PConfirm.vue', () => ({
  default: {
    props: ['show', 'message', 'loading'],
    template: `
      <div v-if="show" class="lyrics-conflict-confirm">
        <span>{{ message }}</span>
        <button class="conflict-confirm" @click="$emit('confirm')">确认</button>
        <button class="conflict-cancel" @click="$emit('cancel')">取消</button>
      </div>
    `,
  },
}))

async function mountPanel(props?: Record<string, unknown>) {
  const module = await import('@/components/music/MusicLyricsPanel.vue')
  return mount(module.default, {
    props: {
      songId: 'song-1',
      songTitle: 'Midnight Radio',
      artistText: 'Atoman',
      currentTimeSeconds: 42,
      ...props,
    },
  })
}

async function openVersionPreview(wrapper: Awaited<ReturnType<typeof mountPanel>>, version = 2) {
  await wrapper.get(`[data-testid="lyrics-version-preview-${version}"]`).trigger('click')
}

describe('MusicLyricsPanel.vue', () => {
  beforeEach(() => {
    authState.isAuthenticated = true
    authState.user = {
      uuid: 'user-1',
      username: 'fafa',
      email: 'fafa@example.com',
    }
    lyricsState.lyrics.value = {
      song_id: 'song-1',
      format: 'plain',
      content: 'Neon lights\nMidnight radio',
      translation: '霓虹灯\n午夜电台',
      version: 3,
      edit_summary: 'initial',
      updated_at: '2026-07-07T00:00:00Z',
      updated_by: 'user-1',
      lines: [
        { line_key: 'line-1', line_index: 0, time_ms: 0, text: 'Neon lights', translation: '霓虹灯' },
        { line_key: 'line-2', line_index: 1, time_ms: 10001, text: 'Midnight radio', translation: '午夜电台' },
      ],
      annotations: [
        {
          id: 'annotation-1',
          song_id: 'song-1',
          line_key: 'line-1',
          body: '第一句的意象',
          selected_text: 'Neon',
          start_offset: 0,
          end_offset: 4,
          upvotes: 3,
          downvotes: 0,
          status: 'active',
          created_at: '2026-07-07T00:00:00Z',
          updated_at: '2026-07-07T00:00:00Z',
          creator: {
            id: 'user-1',
            username: 'fafa',
          },
          viewer_vote: 'none',
        },
      ],
    }
    lyricsState.loading.value = false
    lyricsState.saving.value = false
    lyricsState.reverting.value = false
    lyricsState.errorMessage.value = ''
    lyricsState.versionsErrorMessage.value = ''
    lyricsState.versions.value = [
      {
        id: 'version-2',
        song_id: 'song-1',
        version: 2,
        content: 'Old lyrics',
        translation: '',
        format: 'plain',
        edit_summary: '修正错字',
        created_at: '2026-07-07T01:00:00Z',
        created_by: 'user-1',
      },
    ]
    lyricsState.versionsLoading.value = false
    lyricsState.versionsSongId.value = 'song-1'

    mocks.load.mockReset()
    mocks.save.mockReset()
    mocks.createAnnotation.mockReset()
    mocks.updateAnnotation.mockReset()
    mocks.deleteAnnotation.mockReset()
    mocks.voteAnnotation.mockReset()
    mocks.loadVersions.mockReset()
    mocks.resetVersions.mockReset()
    mocks.revertVersion.mockReset()
    mocks.currentLine.mockReset()
    mocks.removePendingMusicLyricsAnnotation.mockReset()

    mocks.load.mockResolvedValue(undefined)
    mocks.save.mockResolvedValue(lyricsState.lyrics.value)
    mocks.createAnnotation.mockResolvedValue(undefined)
    mocks.updateAnnotation.mockResolvedValue(undefined)
    mocks.deleteAnnotation.mockResolvedValue({ deleted: true })
    mocks.voteAnnotation.mockResolvedValue(undefined)
    mocks.loadVersions.mockResolvedValue(lyricsState.versions.value)
    mocks.revertVersion.mockResolvedValue(true)
    mocks.currentLine.mockReturnValue(lyricsState.lyrics.value.lines[1])
  })

  it('加载歌词并展示当前行与注释面板', async () => {
    const wrapper = await mountPanel()
    await flushPromises()

    expect(mocks.load).toHaveBeenCalledWith('song-1')
    expect(wrapper.findAll('.lyrics-line-stub')).toHaveLength(2)
    expect(wrapper.get('[data-line-id="line-2"]').attributes('data-active')).toBe('true')
    expect(wrapper.get('[data-line-id="line-1"]').attributes('data-annotation-count')).toBe('1')

    await wrapper.get('[data-line-id="line-1"] .open-annotations').trigger('click')

    expect(wrapper.get('.music-annotation-panel__count').text()).toBe('1')
  })

  it('从歌词选区创建注释', async () => {
    const wrapper = await mountPanel()
    await flushPromises()

    await wrapper.get('[data-line-id="line-1"] .select-text').trigger('click')

    expect(wrapper.get('.annotation-editor-selected').text()).toBe('Neon')

    await wrapper.get('.annotation-save').trigger('click')

    expect(mocks.createAnnotation).toHaveBeenCalledWith('song-1', {
      line_key: 'line-1',
      selected_text: 'Neon',
      start_offset: 0,
      end_offset: 4,
      body: '新的注释',
    })
  })

  it('作者可发起待重新绑定并以新选区提交完整锚点', async () => {
    lyricsState.lyrics.value.annotations[0] = {
      ...lyricsState.lyrics.value.annotations[0],
      status: 'needs_rebind',
    }
    const wrapper = await mountPanel()
    await flushPromises()

    await wrapper.get('[data-testid="annotation-rebind-annotation-1"]').trigger('click')
    expect(wrapper.get('.annotation-editor-mode').text()).toBe('rebind')

    await wrapper.get('[data-line-id="line-2"] .select-text').trigger('click')
    expect(wrapper.get('.annotation-editor-selected').text()).toBe('Neon')

    await wrapper.get('.annotation-confirm-rebind').trigger('click')
    expect(mocks.updateAnnotation).toHaveBeenCalledWith('song-1', 'annotation-1', {
      line_key: 'line-2',
      selected_text: 'Neon',
      start_offset: 0,
      end_offset: 4,
    })
    expect(mocks.createAnnotation).not.toHaveBeenCalled()
    expect(mocks.removePendingMusicLyricsAnnotation).toHaveBeenCalledWith('annotation-1')
    expect(wrapper.find('.annotation-editor-stub').exists()).toBe(false)
  })

  it('收到重绑焦点时自动打开作者自己的待重绑注释', async () => {
    lyricsState.lyrics.value.annotations[0] = {
      ...lyricsState.lyrics.value.annotations[0],
      status: 'needs_rebind',
    }
    const wrapper = await mountPanel({ focusAnnotationId: 'annotation-1', startRebind: true })
    await flushPromises()
    expect(wrapper.get('.annotation-editor-mode').text()).toBe('rebind')
  })

  it('取消重绑或切歌时清理重绑状态', async () => {
    lyricsState.lyrics.value.annotations[0] = {
      ...lyricsState.lyrics.value.annotations[0],
      status: 'needs_rebind',
    }
    const wrapper = await mountPanel()
    await flushPromises()

    await wrapper.get('[data-testid="annotation-rebind-annotation-1"]').trigger('click')
    await wrapper.get('.annotation-cancel').trigger('click')
    expect(wrapper.find('.annotation-editor-stub').exists()).toBe(false)

    await wrapper.get('[data-testid="annotation-rebind-annotation-1"]').trigger('click')
    await wrapper.setProps({ songId: 'song-2' })
    expect(wrapper.find('.annotation-editor-stub').exists()).toBe(false)
  })

  it('切歌后旧重绑请求完成不清理新歌曲的重绑状态', async () => {
    const firstRequest = deferred<void>()
    mocks.updateAnnotation.mockReturnValueOnce(firstRequest.promise)
    lyricsState.lyrics.value.annotations[0] = {
      ...lyricsState.lyrics.value.annotations[0],
      status: 'needs_rebind',
    }
    const wrapper = await mountPanel()
    await flushPromises()

    await wrapper.get('[data-testid="annotation-rebind-annotation-1"]').trigger('click')
    await wrapper.get('[data-line-id="line-1"] .select-text').trigger('click')
    await wrapper.get('.annotation-confirm-rebind').trigger('click')

    lyricsState.lyrics.value = {
      ...lyricsState.lyrics.value,
      song_id: 'song-2',
      annotations: [{
        ...lyricsState.lyrics.value.annotations[0],
        id: 'annotation-2',
        song_id: 'song-2',
        status: 'needs_rebind',
      }],
    }
    await wrapper.setProps({ songId: 'song-2' })
    await wrapper.get('[data-testid="annotation-rebind-annotation-2"]').trigger('click')
    expect(wrapper.get('.annotation-editor-mode').text()).toBe('rebind')

    firstRequest.resolve()
    await flushPromises()
    expect(wrapper.get('.annotation-editor-mode').text()).toBe('rebind')

  })

  it('切歌后旧重绑请求失败不清理新歌曲的重绑状态', async () => {
    const firstRequest = deferred<void>()
    mocks.updateAnnotation.mockReturnValueOnce(firstRequest.promise)
    lyricsState.lyrics.value.annotations[0] = {
      ...lyricsState.lyrics.value.annotations[0],
      status: 'needs_rebind',
    }
    const wrapper = await mountPanel()
    await flushPromises()

    await wrapper.get('[data-testid="annotation-rebind-annotation-1"]').trigger('click')
    await wrapper.get('[data-line-id="line-1"] .select-text').trigger('click')
    await wrapper.get('.annotation-confirm-rebind').trigger('click')

    lyricsState.lyrics.value = {
      ...lyricsState.lyrics.value,
      song_id: 'song-2',
      annotations: [{
        ...lyricsState.lyrics.value.annotations[0],
        id: 'annotation-2',
        song_id: 'song-2',
        status: 'needs_rebind',
      }],
    }
    await wrapper.setProps({ songId: 'song-2' })
    await wrapper.get('[data-testid="annotation-rebind-annotation-2"]').trigger('click')

    firstRequest.reject(new Error('late failure'))
    await flushPromises()
    expect(wrapper.get('.annotation-editor-mode').text()).toBe('rebind')
  })

  it('打开歌词编辑抽屉并保存歌词', async () => {
    const wrapper = await mountPanel()
    await flushPromises()

    await wrapper.get('[data-testid="lyrics-edit-trigger"]').trigger('click')

    expect(wrapper.get('.drawer-content').text()).toBe('Neon lights\nMidnight radio')
    expect(wrapper.get('.drawer-translation').text()).toBe('霓虹灯\n午夜电台')
    expect(wrapper.get('.drawer-format').text()).toBe('plain')

    await wrapper.get('.drawer-content-input').setValue('新的歌词')
    await wrapper.get('.drawer-save').trigger('click')

    expect(mocks.save).toHaveBeenCalledWith('song-1', {
      content: '新的歌词',
      translation: 'New translation',
      format: 'plain',
      edit_summary: '修正歌词',
    })
  })

  it('将歌曲标题传给歌词编辑抽屉', async () => {
    const wrapper = await mountPanel({ songTitle: 'Neon Song' })
    await flushPromises()

    await wrapper.get('[data-testid="lyrics-edit-trigger"]').trigger('click')

    expect(wrapper.get('.lyric-editor-drawer-stub').attributes('data-song-title')).toBe('Neon Song')
  })

  it('将当前播放时间原样传给歌词编辑抽屉', async () => {
    const wrapper = await mountPanel({ currentTimeSeconds: 42.375 })
    await flushPromises()

    await wrapper.get('[data-testid="lyrics-edit-trigger"]').trigger('click')

    expect(wrapper.get('.lyric-editor-drawer-stub').attributes('data-current-time-seconds')).toBe('42.375')
  })

  it('原样转发歌词编辑抽屉的定位事件', async () => {
    const wrapper = await mountPanel()
    await flushPromises()

    await wrapper.get('[data-testid="lyrics-edit-trigger"]').trigger('click')
    await wrapper.get('.drawer-seek').trigger('click')

    expect(wrapper.emitted('seek')).toEqual([[19.625]])
  })

  it('预览歌词版本差异后确认恢复', async () => {
    const wrapper = await mountPanel()
    await flushPromises()

    await wrapper.get('[data-testid="lyrics-versions-trigger"]').trigger('click')
    await flushPromises()

    expect(mocks.loadVersions).toHaveBeenCalledWith('song-1')
    expect(wrapper.text()).toContain('修正错字')
    expect(wrapper.find('[data-testid="lyrics-revert-version-2"]').exists()).toBe(false)

    await wrapper.get('[data-testid="lyrics-version-preview-2"]').trigger('click')
    expect(wrapper.get('[data-testid="lyrics-version-diff-2"]').text()).toContain('1 条注释')
    await wrapper.get('[data-testid="lyrics-revert-version-2"]').trigger('click')
    await flushPromises()

    expect(mocks.revertVersion).toHaveBeenCalledWith('song-1', 2, '恢复到第 2 版')
  })

  it('纯翻译变更的版本预览同时展示当前与目标译文', async () => {
    lyricsState.versions.value = [{
      id: 'version-2',
      song_id: 'song-1',
      version: 2,
      content: 'Neon lights\nMidnight radio',
      translation: '新的霓虹灯\n新的午夜电台',
      format: 'plain',
      edit_summary: '更新翻译',
      created_at: '2026-07-07T01:00:00Z',
      created_by: 'user-1',
    }]
    const wrapper = await mountPanel()
    await flushPromises()

    await wrapper.get('[data-testid="lyrics-versions-trigger"]').trigger('click')
    await wrapper.get('[data-testid="lyrics-version-preview-2"]').trigger('click')

    const preview = wrapper.get('[data-testid="lyrics-version-diff-2"]').text()
    expect(preview).toContain('当前译文：霓虹灯')
    expect(preview).toContain('目标译文：新的霓虹灯')
  })

  it('恢复进行中禁用按钮并阻止重复请求', async () => {
    let resolveRevert!: (value: any) => void
    mocks.revertVersion.mockImplementationOnce(() => {
      lyricsState.reverting.value = true
      return new Promise((resolve) => {
        resolveRevert = resolve
      })
    })
    const wrapper = await mountPanel()
    await flushPromises()
    await wrapper.get('[data-testid="lyrics-versions-trigger"]').trigger('click')
    await openVersionPreview(wrapper)
    const revertButton = wrapper.get('[data-testid="lyrics-revert-version-2"]')

    await revertButton.trigger('click')
    await wrapper.vm.$nextTick()
    expect(revertButton.attributes('disabled')).toBeDefined()

    await revertButton.trigger('click')
    expect(mocks.revertVersion).toHaveBeenCalledOnce()

    resolveRevert(true)
    lyricsState.reverting.value = false
    await flushPromises()
  })

  it('恢复进行中禁用歌词编辑入口', async () => {
    lyricsState.reverting.value = true
    const wrapper = await mountPanel()
    await flushPromises()

    expect(wrapper.get('[data-testid="lyrics-edit-trigger"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="lyrics-edit-trigger"]').trigger('click')
    expect(wrapper.find('.lyric-editor-drawer-stub').exists()).toBe(false)
  })

  it('同歌恢复期间关闭并重开版本列表后不被旧 handler 关闭', async () => {
    const pendingRevert = deferred<boolean>()
    mocks.revertVersion.mockReturnValueOnce(pendingRevert.promise)
    const wrapper = await mountPanel()
    await flushPromises()

    await wrapper.get('[data-testid="lyrics-versions-trigger"]').trigger('click')
    await openVersionPreview(wrapper)
    await wrapper.get('[data-testid="lyrics-revert-version-2"]').trigger('click')
    await wrapper.get('[data-testid="lyrics-versions-trigger"]').trigger('click')
    await wrapper.get('[data-testid="lyrics-versions-trigger"]').trigger('click')
    expect(wrapper.find('.music-lyrics-panel__versions').exists()).toBe(true)

    pendingRevert.resolve(true)
    await flushPromises()

    expect(wrapper.find('.music-lyrics-panel__versions').exists()).toBe(true)
  })

  it('旧歌曲恢复请求完成后不关闭重新打开的当前版本列表', async () => {
    let resolveStaleRevert!: (succeeded: boolean) => void
    mocks.revertVersion.mockImplementationOnce(() => new Promise<boolean>((resolve) => {
      resolveStaleRevert = resolve
    }))
    const wrapper = await mountPanel()
    await flushPromises()

    await wrapper.get('[data-testid="lyrics-versions-trigger"]').trigger('click')
    await openVersionPreview(wrapper)
    await wrapper.get('[data-testid="lyrics-revert-version-2"]').trigger('click')

    await wrapper.setProps({ songId: 'song-2' })
    lyricsState.versions.value = [{
      id: 'song-2-version-1',
      song_id: 'song-2',
      version: 1,
      content: 'Song 2 old lyrics',
    }]
    lyricsState.versionsSongId.value = 'song-2'
    lyricsState.reverting.value = false
    await wrapper.get('[data-testid="lyrics-versions-trigger"]').trigger('click')
    expect(wrapper.find('.music-lyrics-panel__versions').exists()).toBe(true)

    resolveStaleRevert(false)
    await flushPromises()

    expect(wrapper.find('.music-lyrics-panel__versions').exists()).toBe(true)
  })

  it('关闭版本列表会失效请求并且不外溢加载失败', async () => {
    mocks.loadVersions.mockImplementationOnce(async () => {
      lyricsState.versionsErrorMessage.value = '版本加载失败'
      throw new Error('versions failed')
    })
    const wrapper = await mountPanel()
    await flushPromises()
    mocks.resetVersions.mockClear()

    await wrapper.get('[data-testid="lyrics-versions-trigger"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('版本加载失败')

    await wrapper.get('[data-testid="lyrics-versions-trigger"]').trigger('click')
    expect(mocks.resetVersions).toHaveBeenCalledOnce()
    expect(wrapper.find('.music-lyrics-panel__versions').exists()).toBe(false)
  })

  it('切歌时立即失效并关闭旧歌曲版本列表', async () => {
    const wrapper = await mountPanel()
    await flushPromises()
    mocks.resetVersions.mockClear()

    await wrapper.get('[data-testid="lyrics-versions-trigger"]').trigger('click')
    await flushPromises()
    await openVersionPreview(wrapper)
    expect(wrapper.find('[data-testid="lyrics-revert-version-2"]').exists()).toBe(true)

    await wrapper.setProps({ songId: 'song-2' })

    expect(mocks.resetVersions).toHaveBeenCalledOnce()
    expect(wrapper.find('.music-lyrics-panel__versions').exists()).toBe(false)
  })

  it('作者标识落在 creator.uuid 时仍显示编辑和删除', async () => {
    lyricsState.lyrics.value.annotations[0].creator = {
      uuid: 'user-1',
      username: 'fafa',
    }

    const wrapper = await mountPanel()
    await flushPromises()
    await wrapper.get('[data-line-id="line-1"] .open-annotations').trigger('click')

    const actionButtons = wrapper.findAll('.music-annotation-card__actions button')
    expect(actionButtons.map((button) => button.text())).toEqual(['编辑', '删除'])
  })

  it('匿名用户只读歌词和版本，不触发注释或版本写操作', async () => {
    authState.isAuthenticated = false
    authState.user = null
    const wrapper = await mountPanel()
    await flushPromises()

    expect(wrapper.find('[data-testid="lyrics-edit-trigger"]').exists()).toBe(false)
    await wrapper.get('[data-testid="lyrics-versions-trigger"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('修正错字')
    expect(wrapper.find('[data-testid="lyrics-revert-version-2"]').exists()).toBe(false)

    await wrapper.get('[data-line-id="line-1"] .select-text').trigger('click')
    expect(wrapper.find('.annotation-editor-stub').exists()).toBe(false)

    await wrapper.get('[data-line-id="line-1"] .open-annotations').trigger('click')
    expect(wrapper.find('.music-annotation-card__vote').exists()).toBe(false)
    expect(wrapper.find('.music-annotation-card__actions').exists()).toBe(false)
    expect(mocks.voteAnnotation).not.toHaveBeenCalled()
    expect(mocks.updateAnnotation).not.toHaveBeenCalled()
    expect(mocks.deleteAnnotation).not.toHaveBeenCalled()
    expect(mocks.revertVersion).not.toHaveBeenCalled()
  })

  it('仅有翻译时提供原文和双语切换，并在切歌后恢复双语', async () => {
    const wrapper = await mountPanel()
    await flushPromises()

    expect(wrapper.get('.lyrics-mode-stub').text()).toContain('原文')
    expect(wrapper.get('.lyrics-mode-stub').text()).toContain('双语')
    expect(wrapper.get('.lyrics-mode-stub').attributes('data-model')).toBe('bilingual')
    expect(wrapper.get('[data-line-id="line-1"]').attributes('data-bilingual')).toBe('true')

    await wrapper.get('[data-mode="original"]').trigger('click')
    expect(wrapper.get('[data-line-id="line-1"]').attributes('data-bilingual')).toBe('false')

    await wrapper.setProps({ songId: 'song-2' })
    await flushPromises()
    expect(wrapper.get('.lyrics-mode-stub').attributes('data-model')).toBe('bilingual')

    lyricsState.lyrics.value = { ...lyricsState.lyrics.value, translation: '' }
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.lyrics-mode-stub').exists()).toBe(false)
  })

  it('当前定时行变化后平滑居中滚动，忽略初始、重复和无时间行', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
    mocks.currentLine.mockImplementation((time: number) => {
      if (time === 3) return { line_key: 'line-untimed', text: 'Untimed', translation: '', time_ms: null }
      return time >= 10 ? lyricsState.lyrics.value.lines[1] : lyricsState.lyrics.value.lines[0]
    })

    const wrapper = await mountPanel()
    await flushPromises()
    expect(scrollIntoView).not.toHaveBeenCalled()

    await wrapper.setProps({ currentTimeSeconds: 1 })
    await flushPromises()
    expect(scrollIntoView).toHaveBeenCalledOnce()
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })

    await wrapper.setProps({ currentTimeSeconds: 2 })
    await flushPromises()
    expect(scrollIntoView).toHaveBeenCalledOnce()

    await wrapper.setProps({ currentTimeSeconds: 3 })
    await flushPromises()
    expect(scrollIntoView).toHaveBeenCalledOnce()
  })

  it('歌词注释冲突经确认后携带全部 needs_rebind resolution 重试', async () => {
    mocks.save
      .mockRejectedValueOnce(new ApiErrorResponseError(409, 'music.annotation_anchor_conflict', 'conflict', {
        annotation_ids: ['annotation-2', 'annotation-1'],
      }))
      .mockResolvedValueOnce(lyricsState.lyrics.value)
    const wrapper = await mountPanel()
    await flushPromises()
    await wrapper.get('[data-testid="lyrics-edit-trigger"]').trigger('click')
    await wrapper.get('.drawer-content-input').setValue('新的歌词')
    await wrapper.get('.drawer-save').trigger('click')
    await flushPromises()

    expect(wrapper.get('.lyrics-conflict-confirm').text()).toContain('这次修改会影响 2 条注释，保存后将通知作者重新确认。')
    expect(wrapper.find('.lyric-editor-drawer-stub').exists()).toBe(true)

    await wrapper.get('.conflict-confirm').trigger('click')
    await flushPromises()
    expect(mocks.save).toHaveBeenLastCalledWith('song-1', {
      content: '新的歌词',
      translation: 'New translation',
      format: 'plain',
      edit_summary: '修正歌词',
      annotation_resolutions: [
        { annotation_id: 'annotation-2', action: 'needs_rebind' },
        { annotation_id: 'annotation-1', action: 'needs_rebind' },
      ],
    })
    expect(wrapper.find('.lyric-editor-drawer-stub').exists()).toBe(false)
  })

  it('A 歌曲保存迟到冲突在切到 B 后不显示确认也不提交 B', async () => {
    const pendingSave = deferred<any>()
    mocks.save.mockReturnValueOnce(pendingSave.promise)
    const wrapper = await mountPanel()
    await flushPromises()

    await wrapper.get('[data-testid="lyrics-edit-trigger"]').trigger('click')
    await wrapper.get('.drawer-content-input').setValue('A 歌曲草稿')
    await wrapper.get('.drawer-save').trigger('click')
    expect(mocks.save).toHaveBeenCalledWith('song-1', expect.objectContaining({ content: 'A 歌曲草稿' }))

    await wrapper.setProps({ songId: 'song-2' })
    pendingSave.reject(new ApiErrorResponseError(409, 'music.annotation_anchor_conflict', 'conflict', {
      annotation_ids: ['annotation-1'],
    }))
    await flushPromises()

    expect(wrapper.find('.lyrics-conflict-confirm').exists()).toBe(false)
    expect(mocks.save).toHaveBeenCalledOnce()
    expect(mocks.save).not.toHaveBeenCalledWith('song-2', expect.anything())
  })

  it('A 歌曲保存迟到成功不关闭切歌后重新打开的 B 编辑器', async () => {
    const pendingSave = deferred<any>()
    mocks.save.mockReturnValueOnce(pendingSave.promise)
    const wrapper = await mountPanel()
    await flushPromises()

    await wrapper.get('[data-testid="lyrics-edit-trigger"]').trigger('click')
    await wrapper.get('.drawer-save').trigger('click')
    await wrapper.setProps({ songId: 'song-2' })
    await wrapper.get('[data-testid="lyrics-edit-trigger"]').trigger('click')

    pendingSave.resolve({ song_id: 'song-1', content: 'saved A' })
    await flushPromises()

    expect(wrapper.find('.lyric-editor-drawer-stub').exists()).toBe(true)
  })

  it('连续冲突确认会合并之前和本轮的 annotation resolutions', async () => {
    mocks.save
      .mockRejectedValueOnce(new ApiErrorResponseError(409, 'music.annotation_anchor_conflict', 'first conflict', {
        annotation_ids: ['annotation-a'],
      }))
      .mockRejectedValueOnce(new ApiErrorResponseError(409, 'music.annotation_anchor_conflict', 'second conflict', {
        annotation_ids: ['annotation-b', 'annotation-a'],
      }))
      .mockResolvedValueOnce(lyricsState.lyrics.value)
    const wrapper = await mountPanel()
    await flushPromises()
    await wrapper.get('[data-testid="lyrics-edit-trigger"]').trigger('click')
    await wrapper.get('.drawer-content-input').setValue('连续冲突草稿')
    await wrapper.get('.drawer-save').trigger('click')
    await flushPromises()

    await wrapper.get('.conflict-confirm').trigger('click')
    await flushPromises()
    expect(mocks.save).toHaveBeenNthCalledWith(2, 'song-1', expect.objectContaining({
      annotation_resolutions: [
        { annotation_id: 'annotation-a', action: 'needs_rebind' },
      ],
    }))
    expect(wrapper.find('.lyrics-conflict-confirm').exists()).toBe(true)

    await wrapper.get('.conflict-confirm').trigger('click')
    await flushPromises()
    expect(mocks.save).toHaveBeenNthCalledWith(3, 'song-1', expect.objectContaining({
      annotation_resolutions: [
        { annotation_id: 'annotation-a', action: 'needs_rebind' },
        { annotation_id: 'annotation-b', action: 'needs_rebind' },
      ],
    }))
    expect(wrapper.find('.lyric-editor-drawer-stub').exists()).toBe(false)
  })

  it('取消冲突确认保留歌词编辑器和草稿，其他错误不弹确认', async () => {
    mocks.save.mockRejectedValueOnce(new ApiErrorResponseError(409, 'music.annotation_anchor_conflict', 'conflict', {
      annotation_ids: ['annotation-1'],
    }))
    const wrapper = await mountPanel()
    await flushPromises()
    await wrapper.get('[data-testid="lyrics-edit-trigger"]').trigger('click')
    await wrapper.get('.drawer-content-input').setValue('尚未保存的用户草稿')
    await wrapper.get('.drawer-save').trigger('click')
    await flushPromises()
    await wrapper.get('.conflict-cancel').trigger('click')

    expect(wrapper.find('.lyrics-conflict-confirm').exists()).toBe(false)
    expect(wrapper.find('.lyric-editor-drawer-stub').exists()).toBe(true)
    expect((wrapper.get('.drawer-content-input').element as HTMLInputElement).value).toBe('尚未保存的用户草稿')

    mocks.save.mockRejectedValueOnce(new ApiErrorResponseError(500, 'system.internal_error', 'failed'))
    await wrapper.get('.drawer-save').trigger('click')
    await flushPromises()
    expect(wrapper.find('.lyrics-conflict-confirm').exists()).toBe(false)
  })

  it('同冲突 code 和 annotation IDs 但非 409 时不弹确认', async () => {
    mocks.save.mockRejectedValueOnce(new ApiErrorResponseError(422, 'music.annotation_anchor_conflict', 'invalid', {
      annotation_ids: ['annotation-1'],
    }))
    const wrapper = await mountPanel()
    await flushPromises()
    await wrapper.get('[data-testid="lyrics-edit-trigger"]').trigger('click')
    await wrapper.get('.drawer-content-input').setValue('不会重试的草稿')
    await wrapper.get('.drawer-save').trigger('click')
    await flushPromises()

    expect(wrapper.find('.lyrics-conflict-confirm').exists()).toBe(false)
    expect(wrapper.find('.lyric-editor-drawer-stub').exists()).toBe(true)
    expect(mocks.save).toHaveBeenCalledOnce()
  })

  it('渲染具有自适应毛玻璃与扁平化操作按钮的结构', async () => {
    const wrapper = await mountPanel()
    await flushPromises()

    // 断言主容器类存在
    expect(wrapper.find('.music-lyrics-panel').exists()).toBe(true)
    // 断言头部和关闭按钮存在
    expect(wrapper.find('.music-lyrics-panel__header').exists()).toBe(true)
    expect(wrapper.find('.music-lyrics-panel__close').exists()).toBe(true)
  })
})

describe('useMusicLyrics', () => {
  beforeEach(() => {
    apiMocks.getMusicSongLyrics.mockReset()
  })

  it('快速切歌时忽略晚返回的旧歌词请求', async () => {
    let resolveSong1: ((value: any) => void) | null = null
    let resolveSong2: ((value: any) => void) | null = null

    apiMocks.getMusicSongLyrics.mockImplementation((songId: string) => new Promise((resolve) => {
      if (songId === 'song-1') resolveSong1 = resolve
      if (songId === 'song-2') resolveSong2 = resolve
    }))

    const { useMusicLyrics } = await vi.importActual<typeof import('@/composables/useMusicLyrics')>('@/composables/useMusicLyrics')
    const musicLyrics = useMusicLyrics()

    const firstLoad = musicLyrics.load('song-1')
    const secondLoad = musicLyrics.load('song-2')

    resolveSong2?.({
      id: 'lyrics-2',
      song_id: 'song-2',
      format: 'plain',
      content: 'Song 2',
      translation: '',
      edit_summary: 'latest',
      updated_at: '2026-07-08T00:00:00Z',
      lines: [],
      annotations: [],
      version: 1,
    })
    await secondLoad

    resolveSong1?.({
      id: 'lyrics-1',
      song_id: 'song-1',
      format: 'plain',
      content: 'Song 1',
      translation: '',
      edit_summary: 'stale',
      updated_at: '2026-07-08T00:00:00Z',
      lines: [],
      annotations: [],
      version: 1,
    })
    await firstLoad

    expect(musicLyrics.lyrics.value?.song_id).toBe('song-2')
    expect(musicLyrics.lyrics.value?.content).toBe('Song 2')
    expect(musicLyrics.loading.value).toBe(false)
    expect(musicLyrics.errorMessage.value).toBe('')
  })
})
