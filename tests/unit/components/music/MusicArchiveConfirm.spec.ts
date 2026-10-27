import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MusicArchiveConfirm from '@/components/music/MusicArchiveConfirm.vue'
vi.mock('@/components/ui/PModal.vue', () => ({ default: { props: ['show'], template: '<div v-if="show"><slot /><slot name="footer" /></div>' } }))
describe('music archive confirmation', () => {
  it('requires an audit reason and emits its trimmed value', async () => {
    const wrapper = mount(MusicArchiveConfirm, { props: { show: true, title: 'Archive' } })
    const button = wrapper.findAll('button').at(-1)!
    expect(button.attributes('disabled')).toBeDefined()
    await wrapper.get('textarea').setValue('  duplicate entry  ')
    await button.trigger('click')
    expect(wrapper.emitted('confirm')).toEqual([['duplicate entry']])
    wrapper.unmount()
  })
  it('does not submit twice while saving and preserves cancellation', async () => {
    const wrapper = mount(MusicArchiveConfirm, { props: { show: true, title: 'Archive', loading: true } })
    expect(wrapper.findAll('button').every(button => button.attributes('disabled') !== undefined)).toBe(true)
    await wrapper.setProps({ loading: false })
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
    wrapper.unmount()
  })
})
