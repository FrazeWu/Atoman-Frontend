import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export interface EditorVirtualKeyboardOptions {
  onKeyboardOpen?: (height: number) => void
  onKeyboardClose?: () => void
}

export function useEditorVirtualKeyboard(
  targetRef: Ref<HTMLElement | null>,
  options: EditorVirtualKeyboardOptions = {},
) {
  const isKeyboardOpen = ref(false)
  const keyboardHeight = ref(0)

  let cleanup: (() => void) | null = null

  const handleViewportChange = () => {
    if (typeof window === 'undefined' || !window.visualViewport) return

    const vv = window.visualViewport
    // 键盘弹出时 visualViewport 高度显著减小
    const heightDiff = window.innerHeight - vv.height
    const open = heightDiff > 100

    if (open) {
      isKeyboardOpen.value = true
      keyboardHeight.value = Math.max(0, Math.round(heightDiff))
      targetRef.value?.style.setProperty('--a-keyboard-inset', `${keyboardHeight.value}px`)
      options.onKeyboardOpen?.(keyboardHeight.value)
    } else {
      isKeyboardOpen.value = false
      keyboardHeight.value = 0
      targetRef.value?.style.setProperty('--a-keyboard-inset', '0px')
      options.onKeyboardClose?.()
    }
  }

  onMounted(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return

    const vv = window.visualViewport
    vv.addEventListener('resize', handleViewportChange, { passive: true })
    vv.addEventListener('scroll', handleViewportChange, { passive: true })

    cleanup = () => {
      vv.removeEventListener('resize', handleViewportChange)
      vv.removeEventListener('scroll', handleViewportChange)
    }
  })

  onBeforeUnmount(() => {
    cleanup?.()
    targetRef.value?.style.removeProperty('--a-keyboard-inset')
  })

  return {
    isKeyboardOpen,
    keyboardHeight,
  }
}
