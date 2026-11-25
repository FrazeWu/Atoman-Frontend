import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { usePaperConfirmation } from '@/components/papers/usePaperConfirmation'

function setup() {
  const scope = ref('project-a')
  let confirm!: ReturnType<typeof usePaperConfirmation>
  const wrapper = mount(defineComponent({
    setup() {
      confirm = usePaperConfirmation()
      return () => h('div')
    },
  }))
  return { scope, confirm, wrapper, ask: () => confirm.ask('Confirm?', () => [scope.value]) }
}
describe('Papers confirmation', () => {
  it('requires an explicit confirmation and blocks concurrent requests', async () => {
    const {confirm, wrapper, ask}=setup()
    const first=ask()
    expect(confirm.confirmationMessage.value).toBe('Confirm?')
    expect(await ask()).toBe(false)
    confirm.resolveConfirmation(true)
    expect(await first).toBe(true)
    expect(confirm.confirmationMessage.value).toBe('')
    wrapper.unmount()
  })
  it('rejects cancelled or stale confirmations', async () => {
    const {confirm, scope, wrapper, ask}=setup()
    const cancelled=ask()
    confirm.resolveConfirmation(false)
    expect(await cancelled).toBe(false)
    const stale=ask()
    scope.value='project-b'
    confirm.resolveConfirmation(true)
    expect(await stale).toBe(false)
    wrapper.unmount()
  })
  it('cancels pending operations on unmount', async () => {
    const {wrapper, ask}=setup()
    const pending=ask()
    wrapper.unmount()
    expect(await pending).toBe(false)
  })
})
