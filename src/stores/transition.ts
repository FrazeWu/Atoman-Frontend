import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTransitionStore = defineStore('transition', () => {
  const isExiting = ref(false)
  const isEntering = ref(false)

  const triggerExit = () => {
    isExiting.value = true
  }

  const triggerEntry = () => {
    isEntering.value = true
    // 600ms 后自动重置，匹配 CSS 动画时间
    setTimeout(() => {
      isEntering.value = false
    }, 800)
  }

  const reset = () => {
    isExiting.value = false
    isEntering.value = false
  }

  return { isExiting, isEntering, triggerExit, triggerEntry, reset }
})