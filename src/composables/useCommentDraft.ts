import { onBeforeUnmount } from 'vue'

import type { CommentTargetRef } from '@/api/comments'

const STORAGE_PREFIX = 'comment_draft:'
const SAVE_DELAY = 600

export function commentDraftKey(target: CommentTargetRef, scope: 'root' | { replyToId: string } = 'root') {
  const suffix = scope === 'root' ? 'root' : `reply:${scope.replyToId}`
  return `comment:${target.kind}:${target.resourceId}:${suffix}`
}

export function useCommentDraft() {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const pending = new Map<string, string>()

  function read(key: string) {
    if (!key || typeof localStorage === 'undefined') return ''
    try {
      return localStorage.getItem(STORAGE_PREFIX + key) ?? ''
    } catch {
      return ''
    }
  }

  function save(key: string, content: string) {
    if (!key || typeof localStorage === 'undefined') return
    pending.delete(key)
    const timer = timers.get(key)
    if (timer) clearTimeout(timer)
    timers.delete(key)
    try {
      if (content.trim()) localStorage.setItem(STORAGE_PREFIX + key, content)
      else localStorage.removeItem(STORAGE_PREFIX + key)
    } catch {
      // 本地存储不可用时不影响评论发布。
    }
  }

  function schedule(key: string, content: string) {
    if (!key) return
    pending.set(key, content)
    const previousTimer = timers.get(key)
    if (previousTimer) clearTimeout(previousTimer)
    timers.set(key, setTimeout(() => {
      const next = pending.get(key)
      if (next !== undefined) save(key, next)
    }, SAVE_DELAY))
  }

  function clear(key: string) {
    save(key, '')
  }

  function flush() {
    for (const [key, content] of pending) save(key, content)
  }

  function clearAll() {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    pending.clear()
  }

  onBeforeUnmount(() => {
    flush()
    clearAll()
  })

  return { read, save, schedule, clear, flush }
}
