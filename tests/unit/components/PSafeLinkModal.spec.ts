import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PSafeLinkModal from '@/components/ui/PSafeLinkModal.vue'
import { useSafeLink } from '@/composables/useSafeLink'

describe('PSafeLinkModal', () => {
  const { openSafeLink, closeSafeLink } = useSafeLink()

  beforeEach(() => {
    closeSafeLink()
  })

  it('does not render dialog when safeLinkState.isOpen is false', () => {
    const wrapper = mount(PSafeLinkModal, {
      global: {
        stubs: { Teleport: true },
      },
    })
    expect(wrapper.find('.p-safe-link-modal').exists()).toBe(false)
  })

  it('renders modal with target domain and buttons when open', async () => {
    openSafeLink('https://github.com/atoman')
    const wrapper = mount(PSafeLinkModal, {
      global: {
        stubs: { Teleport: true },
      },
    })

    expect(wrapper.find('.p-safe-link-modal').exists()).toBe(true)
    expect(wrapper.text()).toContain('github.com')
    expect(wrapper.find('[data-test="proceed-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="copy-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="cancel-btn"]').exists()).toBe(true)
  })

  it('closes modal when cancel button is clicked', async () => {
    openSafeLink('https://github.com/atoman')
    const wrapper = mount(PSafeLinkModal, {
      global: {
        stubs: { Teleport: true },
      },
    })

    expect(wrapper.find('.p-safe-link-modal').exists()).toBe(true)
    await wrapper.find('[data-test="cancel-btn"]').trigger('click')
    expect(wrapper.find('.p-safe-link-modal').exists()).toBe(false)
  })

  it('closes modal when close (X) button is clicked', async () => {
    openSafeLink('https://github.com/atoman')
    const wrapper = mount(PSafeLinkModal, {
      global: {
        stubs: { Teleport: true },
      },
    })

    expect(wrapper.find('.p-safe-link-modal').exists()).toBe(true)
    await wrapper.find('.p-safe-link-modal__close').trigger('click')
    expect(wrapper.find('.p-safe-link-modal').exists()).toBe(false)
  })
})
