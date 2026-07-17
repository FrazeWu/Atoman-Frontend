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
  revertVersion: vi.fn(),
  currentLine: vi.fn(),
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
  errorMessage: ref(''),
  versions: ref<any[]>([]),
  versionsLoading: ref(false),
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
    versionsLoading: lyricsState.versionsLoading,
    loadVersions: mocks.loadVersions,
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
    props: ['show', 'selectedText', 'initialBody'],
    template: `
      <div v-if="show" class="annotation-editor-stub">
        <span class="annotation-editor-selected">{{ selectedText }}</span>
        <span class="annotation-editor-body">{{ initialBody }}</span>
        <button type="button" class="annotation-save" @click="$emit('save', '新的注释')">保存注释</button>
        <button type="button" class="annotation-cancel" @click="$emit('cancel')">取消注释</button>
      </div>
    `,
  },
}))

vi.mock('@/components/music/MusicLyricEditorDrawer.vue', () => ({
  default: {
    props: ['show', 'content', 'translation', 'format', 'saving'],
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
      <div v-if="show" class="lyric-editor-drawer-stub">
        <span class="drawer-content">{{ draftContent }}</span>
        <input v-model="draftContent" class="drawer-content-input" />
        <span class="drawer-translation">{{ translation }}</span>
        <span class="drawer-format">{{ format }}</span>
        <button type="button" class="drawer-save" @click="$emit('save', { content: draftContent, translation: 'New translation', format: 'plain', editSummary: '修正歌词' })">
          保存歌词
        </button>
        <button type="button" class="drawer-close" @click="$emit('close')">关闭抽屉</button>
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
    lyricsState.errorMessage.value = ''
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

    mocks.load.mockReset()
    mocks.save.mockReset()
    mocks.createAnnotation.mockReset()
    mocks.updateAnnotation.mockReset()
    mocks.deleteAnnotation.mockReset()
    mocks.voteAnnotation.mockReset()
    mocks.loadVersions.mockReset()
    mocks.revertVersion.mockReset()
    mocks.currentLine.mockReset()

    mocks.load.mockResolvedValue(undefined)
    mocks.save.mockResolvedValue(lyricsState.lyrics.value)
    mocks.createAnnotation.mockResolvedValue(undefined)
    mocks.updateAnnotation.mockResolvedValue(undefined)
    mocks.deleteAnnotation.mockResolvedValue({ deleted: true })
    mocks.voteAnnotation.mockResolvedValue(undefined)
    mocks.loadVersions.mockResolvedValue(lyricsState.versions.value)
    mocks.revertVersion.mockResolvedValue(lyricsState.lyrics.value)
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

  it('查看并恢复歌词版本', async () => {
    const wrapper = await mountPanel()
    await flushPromises()

    await wrapper.get('[data-testid="lyrics-versions-trigger"]').trigger('click')
    await flushPromises()

    expect(mocks.loadVersions).toHaveBeenCalledWith('song-1')
    expect(wrapper.text()).toContain('修正错字')

    await wrapper.get('[data-testid="lyrics-revert-version-2"]').trigger('click')
    await flushPromises()

    expect(mocks.revertVersion).toHaveBeenCalledWith('song-1', 2, '恢复到第 2 版')
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
