import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface Sheet {
  id: string
  type: 'post' | 'collection'
  title: string
}

export const useSheetStore = defineStore('sheet', () => {
  const stack = ref<Sheet[]>([])

  const pushSheet = (sheet: Sheet, updateHistory = true) => {
    stack.value.push(sheet)
    
    if (updateHistory) {
      const url = sheet.type === 'post' ? `/post/${sheet.id}` : `/collection/${sheet.id}`
      history.pushState({ isSheet: true, index: stack.value.length - 1 }, '', url)
    }
  }

  const popSheet = (updateHistory = true) => {
    if (stack.value.length === 0) return
    stack.value.pop()
    
    if (updateHistory) {
      history.back()
    }
  }

  const popSheetsFrom = (index: number, updateHistory = true) => {
    if (index < 0 || index >= stack.value.length) return
    const stepsToGoBack = stack.value.length - index
    stack.value = stack.value.slice(0, index)
    
    if (updateHistory && stepsToGoBack > 0) {
      history.go(-stepsToGoBack)
    }
  }

  const clearStack = (updateHistory = true) => {
    const stepsToGoBack = stack.value.length
    stack.value = []
    
    if (updateHistory && stepsToGoBack > 0) {
      history.go(-stepsToGoBack)
    }
  }

  const updateSheetTitle = (id: string, type: 'post' | 'collection', title: string) => {
    const sheet = stack.value.find(s => s.id === id && s.type === type)
    if (sheet) {
      sheet.title = title
    }
  }

  const jumpToSheet = (index: number, updateHistory = true) => {
    if (index < 0 || index >= stack.value.length - 1) return
    const targetIndex = index + 1
    const stepsToGoBack = stack.value.length - targetIndex
    stack.value = stack.value.slice(0, targetIndex)
    
    if (updateHistory && stepsToGoBack > 0) {
      history.go(-stepsToGoBack)
    }
  }

  const handlePopState = (event: PopStateEvent) => {
    const state = event.state
    if (state && state.isSheet && typeof state.index === 'number') {
      const targetIndex = state.index
      if (targetIndex < stack.value.length) {
        stack.value = stack.value.slice(0, targetIndex + 1)
      }
    } else {
      stack.value = []
    }
  }

  return {
    stack,
    pushSheet,
    popSheet,
    popSheetsFrom,
    jumpToSheet,
    clearStack,
    updateSheetTitle,
    handlePopState
  }
})
