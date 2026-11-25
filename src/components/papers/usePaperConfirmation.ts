import { onBeforeUnmount, ref } from 'vue'

/** A component-owned, single-flight confirmation. Never execute a stale
 * confirmation after a project, account, revision or selection changes. */
export function usePaperConfirmation() {
  const confirmationMessage = ref('')
  let pending: { resolve: (answer: boolean) => void; valid: () => boolean } | null = null

  function ask(message: string, capture: () => readonly unknown[]): Promise<boolean> {
    if (pending) return Promise.resolve(false)
    const before = capture()
    const valid = () => {
      const after = capture()
      return before.length === after.length && before.every((value, index) => Object.is(value, after[index]))
    }
    return new Promise(resolve => {
      pending = { resolve, valid }
      confirmationMessage.value = message
    })
  }

  function resolveConfirmation(answer: boolean) {
    const current = pending
    if (!current) return
    pending = null
    confirmationMessage.value = ''
    current.resolve(answer && current.valid())
  }

  onBeforeUnmount(() => resolveConfirmation(false))
  return { confirmationMessage, ask, resolveConfirmation }
}
