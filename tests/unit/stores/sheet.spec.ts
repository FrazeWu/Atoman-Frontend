import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSheetStore } from '@/stores/sheet'

describe('sheet history routes', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('writes registered post and collection URLs', () => {
    const pushState = vi.spyOn(history, 'pushState')
    const store = useSheetStore()

    store.pushSheet({ id: 'post-1', type: 'post', title: '文章' })
    store.pushSheet({ id: 'collection-1', type: 'collection', title: '合集' })

    expect(pushState).toHaveBeenNthCalledWith(1, expect.any(Object), '', '/posts/post/post-1')
    expect(pushState).toHaveBeenNthCalledWith(2, expect.any(Object), '', '/posts/collection/collection-1')
  })
})
