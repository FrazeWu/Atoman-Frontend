import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTransitionStore = defineStore('transition', () => {
  const isExiting = ref(false)
  const isEntering = ref(false)
  let exitTimer: ReturnType<typeof setTimeout> | undefined
  let entryTimer: ReturnType<typeof setTimeout> | undefined

  const clearExitTimer = () => {
    if (exitTimer) clearTimeout(exitTimer)
    exitTimer = undefined
  }

  const clearEntryTimer = () => {
    if (entryTimer) clearTimeout(entryTimer)
    entryTimer = undefined
  }

  const triggerExit = () => {
    clearExitTimer()
    isEntering.value = false
    isExiting.value = true
    // A failed or interrupted navigation must not leave the entire page invisible.
    exitTimer = setTimeout(() => {
      isExiting.value = false
      exitTimer = undefined
    }, 1000)
  }

  const triggerEntry = () => {
    clearExitTimer()
    clearEntryTimer()
    isExiting.value = false
    isEntering.value = true
    entryTimer = setTimeout(() => {
      isEntering.value = false
      entryTimer = undefined
    }, 800)
  }

  const reset = () => {
    clearExitTimer()
    clearEntryTimer()
    isExiting.value = false
    isEntering.value = false
  }

  return { isExiting, isEntering, triggerExit, triggerEntry, reset }
})