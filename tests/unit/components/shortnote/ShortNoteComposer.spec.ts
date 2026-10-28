import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

import ShortNoteComposer from '@/components/shortnote/ShortNoteComposer.vue'
import MediaPickerModal from '@/components/shared/MediaPickerModal.vue'
import type { MediaPickerItem } from '@/types/mediaPicker'

vi.mock('@/api/client', () => ({
  apiRequestResult: vi.fn(),
}))

describe('ShortNoteComposer - 视听附件挂载', () => {
  let pinia: ReturnType<typeof createPinia>
  const mountedWrappers: VueWrapper[] = []

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach((w) => w.unmount())
  })

  function createWrapper(props: Record<string, unknown> = {}) {
    const wrapper = mount(ShortNoteComposer, {
      props: {
        ...props,
      },
      global: {
        plugins: [pinia],
      },
    })
    mountedWrappers.push(wrapper)
    return wrapper
  }

  it('点击「视听」按钮打开选择器', async () => {
    const wrapper = createWrapper()

    const mediaPickerBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('视听') || b.attributes('aria-label') === '视听')
    expect(mediaPickerBtn?.exists()).toBe(true)

    const modalBefore = wrapper.findComponent(MediaPickerModal)
    expect(modalBefore.exists()).toBe(true)
    expect(modalBefore.props('open')).toBe(false)

    await mediaPickerBtn!.trigger('click')
    await nextTick()

    const modalAfter = wrapper.findComponent(MediaPickerModal)
    expect(modalAfter.props('open')).toBe(true)
  })

  it('选中项目后展示卡片预览条并关闭弹窗', async () => {
    const wrapper = createWrapper()

    const mediaPickerBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('视听') || b.attributes('aria-label') === '视听')!
    await mediaPickerBtn.trigger('click')
    await nextTick()

    const modal = wrapper.findComponent(MediaPickerModal)
    const testItem: MediaPickerItem = {
      id: 'song-uuid-001',
      type: 'song',
      title: '七里香',
      subtitle: '周杰伦',
      cover_url: 'https://example.test/cover.jpg',
    }

    modal.vm.$emit('select', testItem)
    await nextTick()

    expect(modal.props('open')).toBe(false)

    const preview = wrapper.find('[data-testid="short-note-media-attachment"]')
    expect(preview.exists()).toBe(true)
    expect(preview.text()).toContain('七里香')
    expect(preview.text()).toContain('周杰伦')
    expect(preview.find('img').attributes('src')).toBe('https://example.test/cover.jpg')
  })

  it('点击提交时 payload 包含 media_attachment_type 与 media_attachment_id', async () => {
    const wrapper = createWrapper()

    const modal = wrapper.findComponent(MediaPickerModal)
    const testItem: MediaPickerItem = {
      id: 'album-uuid-002',
      type: 'album',
      title: '范特西',
      subtitle: '周杰伦',
    }
    modal.vm.$emit('select', testItem)
    await nextTick()

    await wrapper.get('textarea').setValue('这是一条带专辑附件的短笺')
    await wrapper.get('form').trigger('submit')

    const emitted = wrapper.emitted('submit')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toEqual({
      content: '这是一条带专辑附件的短笺',
      media_urls: [],
      media_attachment_type: 'album',
      media_attachment_id: 'album-uuid-002',
    })
  })

  it('点击移除按钮可取消挂载视听附件', async () => {
    const wrapper = createWrapper()

    const modal = wrapper.findComponent(MediaPickerModal)
    modal.vm.$emit('select', {
      id: 'video-uuid-003',
      type: 'video',
      title: 'MV 视频',
    })
    await nextTick()

    const preview = wrapper.find('[data-testid="short-note-media-attachment"]')
    expect(preview.exists()).toBe(true)

    const removeBtn = preview.find('button[aria-label="移除视听附件"]')
    expect(removeBtn.exists()).toBe(true)
    await removeBtn.trigger('click')
    await nextTick()

    expect(wrapper.find('[data-testid="short-note-media-attachment"]').exists()).toBe(false)

    await wrapper.get('textarea').setValue('移除附件后提交')
    await wrapper.get('form').trigger('submit')

    const emitted = wrapper.emitted('submit')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toEqual({
      content: '移除附件后提交',
      media_urls: [],
    })
  })
})

describe('ShortNoteComposer - 自动防抖暂存与草稿恢复', () => {
  let pinia: ReturnType<typeof createPinia>
  const mountedWrappers: VueWrapper[] = []
  const DRAFT_KEY = 'atoman:short_note_composer_draft'

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach((w) => w.unmount())
    vi.restoreAllMocks()
    vi.useRealTimers()
    localStorage.clear()
  })

  function createWrapper(props: Record<string, unknown> = {}) {
    const wrapper = mount(ShortNoteComposer, {
      props: {
        ...props,
      },
      global: {
        plugins: [pinia],
      },
    })
    mountedWrappers.push(wrapper)
    return wrapper
  }

  it('输入内容后防抖 500ms 暂存到 localStorage', async () => {
    const wrapper = createWrapper()
    await wrapper.get('textarea').setValue('正在输入短笺草稿…')
    await nextTick()

    // 尚未达到 500ms，不应写入
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()

    // 前进 500ms 触发防抖存储
    await vi.advanceTimersByTimeAsync(500)

    const stored = localStorage.getItem(DRAFT_KEY)
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.payload).toEqual({
      content: '正在输入短笺草稿…',
      mediaUrls: [],
    })
  })

  it('挂载时若存在本地草稿且无初始内容，自动回填内容与图片', async () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        payload: {
          content: '恢复的草稿内容',
          mediaUrls: ['https://example.test/pic1.jpg'],
        },
        saved_at: Date.now(),
      })
    )

    const wrapper = createWrapper()
    await nextTick()

    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('恢复的草稿内容')
    expect(wrapper.findAll('[data-testid="short-note-media"] img').length).toBe(1)
  })

  it('挂载时若已有 props.initialContent 则不被草稿覆盖', async () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        payload: {
          content: '本地遗留草稿',
          mediaUrls: [],
        },
        saved_at: Date.now(),
      })
    )

    const wrapper = createWrapper({ initialContent: '页面指定初始内容' })
    await nextTick()

    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('页面指定初始内容')
  })

  it('发布成功（表单提交）后自动清理本地草稿', async () => {
    const wrapper = createWrapper()
    await wrapper.get('textarea').setValue('准备发布的短笺')
    await vi.advanceTimersByTimeAsync(500)

    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull()

    await wrapper.get('form').trigger('submit')
    await nextTick()

    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('内容与图片被清空后防抖从 localStorage 中移除草稿', async () => {
    const wrapper = createWrapper()
    await wrapper.get('textarea').setValue('初始草稿')
    await vi.advanceTimersByTimeAsync(500)
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull()

    await wrapper.get('textarea').setValue('   ')
    await vi.advanceTimersByTimeAsync(500)
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('图片列表变化时亦触发防抖暂存', async () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        payload: {
          content: '',
          mediaUrls: ['https://example.test/img1.jpg', 'https://example.test/img2.jpg'],
        },
        saved_at: Date.now(),
      })
    )

    const wrapper = createWrapper()
    await nextTick()

    expect(wrapper.findAll('.short-note-composer__preview').length).toBe(2)

    // 点击移除第一张图片
    const removeBtns = wrapper.findAll('.short-note-composer__remove-btn')
    await removeBtns[0].trigger('click')
    await nextTick()

    await vi.advanceTimersByTimeAsync(500)

    const stored = localStorage.getItem(DRAFT_KEY)
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.payload.mediaUrls).toEqual(['https://example.test/img2.jpg'])
  })
})
