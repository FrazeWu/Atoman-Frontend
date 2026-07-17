import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PModal from '@/components/ui/PModal.vue'

describe('PModal.vue', () => {
  it('can render above player overlays when explicitly requested', () => {
    const wrapper = mount(PModal, {
      props: { show: true, abovePlayer: true },
    })

    const backdrop = document.querySelector('.p-modal-backdrop')
    expect(backdrop).toBeInstanceOf(HTMLElement)
    expect(backdrop?.classList.contains('p-modal-backdrop--above-player')).toBe(true)
    wrapper.unmount()
  })
})
