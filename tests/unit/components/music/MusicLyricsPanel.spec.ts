import { computed, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  createAnnotation: vi.fn(),
  updateAnnotation: vi.fn(),
  deleteAnnotation: vi.fn(),
  voteAnnotation: vi.fn(),
  currentLine: vi.fn(),
}))

const lyricsState = {
  lyrics: ref<any>(null),
  loading: ref(false),
  saving: ref(false),
  errorMessage: ref(''),
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
    currentLine: mocks.currentLine,
  }),
}))

vi.mock('@/components/music/MusicLyricsLine.vue', () => ({
  default: {
    props: ['line', 'annotations', 'active', 'bilingual'],
    template: `
      <div
        class="lyrics-line-stub"
        :data-line-id="line.line_key ?? line.id"
        :data-active="String(active)"
        :data-annotation-count="annotations.length"
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

vi.mock('@/components/music/MusicAnnotationPanel.vue', () => ({
  default: {
    props: ['annotations'],
    template: `
      <div class="annotation-panel-stub">
        <span class="annotation-count">{{ annotations.length }}</span>
        <button type="button" class="vote-annotation" @click="$emit('vote', annotations[0]?.id, 'up')">投票</button>
        <button type="button" class="edit-annotation" @click="$emit('edit', annotations[0])">编辑</button>
        <button type="button" class="delete-annotation" @click="$emit('delete', annotations[0]?.id)">删除</button>
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
    template: `
      <div v-if="show" class="lyric-editor-drawer-stub">
        <span class="drawer-content">{{ content }}</span>
        <span class="drawer-translation">{{ translation }}</span>
        <span class="drawer-format">{{ format }}</span>
        <button type="button" class="drawer-save" @click="$emit('save', { content: '新的歌词', translation: 'New translation', format: 'plain', editSummary: '修正歌词' })">
          保存歌词
        </button>
        <button type="button" class="drawer-close" @click="$emit('close')">关闭抽屉</button>
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

    mocks.load.mockReset()
    mocks.save.mockReset()
    mocks.createAnnotation.mockReset()
    mocks.updateAnnotation.mockReset()
    mocks.deleteAnnotation.mockReset()
    mocks.voteAnnotation.mockReset()
    mocks.currentLine.mockReset()

    mocks.load.mockResolvedValue(undefined)
    mocks.save.mockResolvedValue(lyricsState.lyrics.value)
    mocks.createAnnotation.mockResolvedValue(undefined)
    mocks.updateAnnotation.mockResolvedValue(undefined)
    mocks.deleteAnnotation.mockResolvedValue({ deleted: true })
    mocks.voteAnnotation.mockResolvedValue(undefined)
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

    expect(wrapper.get('.annotation-count').text()).toBe('1')
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

    await wrapper.get('.drawer-save').trigger('click')

    expect(mocks.save).toHaveBeenCalledWith('song-1', {
      content: '新的歌词',
      translation: 'New translation',
      format: 'plain',
      edit_summary: '修正歌词',
    })
  })
})
