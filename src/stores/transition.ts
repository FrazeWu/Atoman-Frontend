import { defineStore } from 'pinia'
import { ref } from 'vue'
import { motionTimings } from '@/config/motion'

export const useTransitionStore = defineStore('transition', () => {
  const isExiting = ref(false)
  const isEntering = ref(false)
  const isModuleNavigation = ref(false)
  let exitTimer: ReturnType<typeof setTimeout> | undefined
  let exitRecoveryTimer: ReturnType<typeof setTimeout> | undefined
  let entryTimer: ReturnType<typeof setTimeout> | undefined
  let exitResolver: (() => void) | undefined

  const clearExitTimer = () => {
    if (exitTimer) clearTimeout(exitTimer)
    exitTimer = undefined
  }

  const clearExitRecoveryTimer = () => {
    if (exitRecoveryTimer) clearTimeout(exitRecoveryTimer)
    exitRecoveryTimer = undefined
  }

  const clearEntryTimer = () => {
    if (entryTimer) clearTimeout(entryTimer)
    entryTimer = undefined
  }

  const settleExit = () => {
    clearExitTimer()
    const resolve = exitResolver
    exitResolver = undefined
    resolve?.()
  }

  const triggerExit = () => {
    settleExit()
    clearExitRecoveryTimer()
    clearEntryTimer()
    isModuleNavigation.value = false
    isEntering.value = false
    isExiting.value = true

    const exit = new Promise<void>((resolve) => {
      exitResolver = resolve
      // CSS transitionend is the normal completion path. This fallback keeps
      // navigation recoverable when the browser skips the event.
      exitTimer = setTimeout(settleExit, motionTimings.exitFallback)
      exitRecoveryTimer = setTimeout(() => {
        if (!isExiting.value) return
        settleExit()
        isExiting.value = false
        exitRecoveryTimer = undefined
      }, motionTimings.exitRecovery)
    })

    return exit
  }

  const completeExit = () => {
    settleExit()
  }

  const triggerEntry = () => {
    settleExit()
    clearExitRecoveryTimer()
    clearEntryTimer()
    isModuleNavigation.value = false
    isExiting.value = false
    isEntering.value = true
    entryTimer = setTimeout(() => {
      isEntering.value = false
      entryTimer = undefined
    }, motionTimings.detailEntry)
  }

  const startModuleNavigation = () => {
    settleExit()
    clearExitRecoveryTimer()
    clearEntryTimer()
    isExiting.value = false
    isEntering.value = false
    isModuleNavigation.value = true
  }

  const finishModuleNavigation = () => {
    isModuleNavigation.value = false
  }

  const reset = () => {
    settleExit()
    clearExitRecoveryTimer()
    clearEntryTimer()
    isExiting.value = false
    isEntering.value = false
    isModuleNavigation.value = false
  }

  return {
    isExiting,
    isEntering,
    isModuleNavigation,
    triggerExit,
    completeExit,
    triggerEntry,
    startModuleNavigation,
    finishModuleNavigation,
    reset,
  }
})
