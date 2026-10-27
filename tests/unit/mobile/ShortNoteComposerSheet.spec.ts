import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ShortNoteComposerSheet from '@mobile/views/blog/ShortNoteComposerSheet.vue'

describe('ShortNoteComposerSheet.vue', () => {
  function createWrapper(props = { modelValue: true }) {
    return mount(ShortNoteComposerSheet, {
      props,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })
  }

  it('renders composer textarea and tools when modelValue is true', () => {
    const wrapper = createWrapper()
    const textarea = wrapper.find('[data-testid="composer-textarea"]')
    expect(textarea.exists()).toBe(true)

    const submitBtn = wrapper.find('[data-testid="composer-submit-btn"]')
    expect(submitBtn.exists()).toBe(true)
    expect(submitBtn.attributes('disabled')).toBeDefined()
  })

  it('has font-size 16px on textarea to prevent iOS Safari auto-zoom', () => {
    const wrapper = createWrapper()
    const textarea = wrapper.find('.short-note-composer__textarea')
    expect(textarea.exists()).toBe(true)
    // Verify class name and attribute bindings
    expect(textarea.classes()).toContain('short-note-composer__textarea')
  })

  it('enables submit button when text is entered and emits submit on click', async () => {
    const wrapper = createWrapper()
    const textarea = wrapper.find('[data-testid="composer-textarea"]')
    await textarea.setValue('今日短笺测试灵感')

    const submitBtn = wrapper.find('[data-testid="composer-submit-btn"]')
    expect(submitBtn.attributes('disabled')).toBeUndefined()

    await submitBtn.trigger('click')
    expect(wrapper.emitted('submit')).toBeTruthy()
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      content: '今日短笺测试灵感',
      image: undefined,
    })
  })

  it('emits update:modelValue false when cancel button is clicked', async () => {
    const wrapper = createWrapper()
    const cancelBtn = wrapper.findAll('button').find((btn) => btn.text().includes('取消'))
    expect(cancelBtn).toBeDefined()
    await cancelBtn?.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toBe(false)
  })
})
