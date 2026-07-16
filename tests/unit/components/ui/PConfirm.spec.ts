import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import PConfirm from '@/components/ui/PConfirm.vue'

const PModalStub = defineComponent({
  name: 'PModal',
  emits: ['close', 'update:show'],
  template: '<div><slot /><slot name="footer" /></div>',
})

const PButtonStub = defineComponent({
  name: 'PButton',
  props: ['disabled', 'loading', 'label', 'loadingText'],
  emits: ['click'],
  template: '<button :disabled="disabled || loading" :data-loading="String(Boolean(loading))" @click="$emit(\'click\')">{{ loading ? loadingText : label }}</button>',
})

const mountConfirm = (loading: boolean) => mount(PConfirm, {
  props: {
    show: true,
    loading,
    loadingText: '删除中...',
  },
  global: {
    stubs: {
      PModal: PModalStub,
      PButton: PButtonStub,
    },
  },
})

describe('PConfirm', () => {
  it('disables the confirmation action and shows its loading state while pending', async () => {
    const wrapper = mountConfirm(true)

    const confirmButton = wrapper.findAll('button')[1]
    expect(confirmButton.attributes()).toHaveProperty('disabled')
    expect(confirmButton.attributes('data-loading')).toBe('true')

    await confirmButton.trigger('click')
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('does not cancel through buttons or modal close events while pending', async () => {
    const wrapper = mountConfirm(true)
    const modal = wrapper.findComponent(PModalStub)

    await wrapper.findAll('button')[0].trigger('click')
    modal.vm.$emit('close')
    modal.vm.$emit('update:show', false)
    await nextTick()

    expect(wrapper.emitted('cancel')).toBeUndefined()
  })

  it('keeps confirmation, cancellation, and modal close behavior when idle', async () => {
    const wrapper = mountConfirm(false)
    const modal = wrapper.findComponent(PModalStub)

    await wrapper.findAll('button')[1].trigger('click')
    await wrapper.findAll('button')[0].trigger('click')
    modal.vm.$emit('close')
    modal.vm.$emit('update:show', false)
    modal.vm.$emit('update:show', true)
    await nextTick()

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toHaveLength(3)
  })
})
