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
