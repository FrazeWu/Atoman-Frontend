import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PostCoverField from '@/components/blog/PostCoverField.vue'
import PButton from '@/components/ui/PButton.vue'

describe('PostCoverField', () => {
  it('未上传封面时展示空状态与点击上传提示', () => {
    const wrapper = mount(PostCoverField, {
      props: {
        coverUrl: '',
        uploading: false,
        error: '',
      },
    })

    expect(wrapper.text()).toContain('点击或拖拽图片至此')
    expect(wrapper.text()).toContain('上传封面')
    expect(wrapper.find('.cover-empty-state').exists()).toBe(true)
    expect(wrapper.find('.cover-preview-image').exists()).toBe(false)
  })

  it('已上传封面时渲染图片预览并提供更换与移除操作', async () => {
    const wrapper = mount(PostCoverField, {
      props: {
        coverUrl: 'https://example.com/cover.jpg',
        uploading: false,
        error: '',
      },
    })

    expect(wrapper.find('.cover-preview-image').attributes('src')).toBe('https://example.com/cover.jpg')
    expect(wrapper.text()).toContain('更换封面')
    expect(wrapper.text()).toContain('移除封面')

    const removeBtn = wrapper.findAllComponents(PButton).find(btn => btn.text().includes('移除封面'))
    expect(removeBtn).toBeTruthy()
    await removeBtn?.trigger('click')
    expect(wrapper.emitted('remove-cover')).toBeTruthy()
  })

  it('拖拽文件悬停时呈现拖拽高亮，松开时触发 file-selected', async () => {
    const wrapper = mount(PostCoverField, {
      props: {
        coverUrl: '',
        uploading: false,
        error: '',
      },
    })

    const card = wrapper.find('.cover-upload-card')
    await card.trigger('dragenter', {
      dataTransfer: { types: ['Files'] },
    })

    expect(card.classes()).toContain('is-dragging')

    const dummyFile = new File(['image-content'], 'test-cover.png', { type: 'image/png' })
    await card.trigger('drop', {
      dataTransfer: { files: [dummyFile] },
    })

    expect(card.classes()).not.toContain('is-dragging')
    expect(wrapper.emitted('file-selected')).toBeTruthy()
    expect(wrapper.emitted('file-selected')?.[0]?.[0]).toBe(dummyFile)
  })

  it('支持在区域内直接粘贴图片文件', async () => {
    const wrapper = mount(PostCoverField, {
      props: {
        coverUrl: '',
        uploading: false,
        error: '',
      },
    })

    const dummyFile = new File(['pasted-content'], 'clipboard.jpg', { type: 'image/jpeg' })
    const card = wrapper.find('.cover-upload-card')

    await card.trigger('paste', {
      clipboardData: {
        items: [
          {
            type: 'image/jpeg',
            getAsFile: () => dummyFile,
          },
        ],
      },
    })

    expect(wrapper.emitted('file-selected')).toBeTruthy()
    expect(wrapper.emitted('file-selected')?.[0]?.[0]).toBe(dummyFile)
  })

  it('展示错误信息', () => {
    const wrapper = mount(PostCoverField, {
      props: {
        coverUrl: '',
        uploading: false,
        error: '图片不能超过 5MB',
      },
    })

    expect(wrapper.find('.cover-upload-error').text()).toBe('图片不能超过 5MB')
  })
})
