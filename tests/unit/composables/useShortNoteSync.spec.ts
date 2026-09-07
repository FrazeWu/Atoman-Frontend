import { beforeEach, describe, expect, it } from 'vitest'
import { useShortNoteSync } from '@/composables/blog/useShortNoteSync'

describe('useShortNoteSync', () => {
  beforeEach(() => localStorage.clear())

  it('通过状态同步标记已读时持久化到 localStorage', () => {
    const sync = useShortNoteSync()
    sync.updateNoteState('note-persisted', { read: true })

    expect(JSON.parse(localStorage.getItem('atoman:read_short_notes') || '[]')).toContain('note-persisted')
  })
})
