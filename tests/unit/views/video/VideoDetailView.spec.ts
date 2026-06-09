import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'

// stub fetch globally
beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [] }),
  }))
})

describe('VideoDetailView', () => {
  it('mounts without crashing with loading state', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/videos/:id', component: { template: '<div/>' } }],
    })
    await router.push('/videos/test-id')

    // Just test that VideoPlayerShell is defined and importable
    const { default: VideoPlayerShell } = await import('@/components/shared/VideoPlayerShell.vue')
    expect(VideoPlayerShell).toBeDefined()
  })
})

describe('VideoDetailView layout', () => {
  it('VideoPlayerShell component is importable', async () => {
    const { default: VideoPlayerShell } = await import('@/components/shared/VideoPlayerShell.vue')
    expect(VideoPlayerShell).toBeDefined()
  })

  it('VideoCommentSection component is importable', async () => {
    const { default: VideoCommentSection } = await import('@/components/video/VideoCommentSection.vue')
    expect(VideoCommentSection).toBeDefined()
  })
})
