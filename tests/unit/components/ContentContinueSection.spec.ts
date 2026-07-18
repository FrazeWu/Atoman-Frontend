import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentContinueSection from '@/components/content/ContentContinueSection.vue'
import { useAuthStore } from '@/stores/auth'

describe('ContentContinueSection', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('loads and renders authenticated continue items for one module', async () => {
    const auth = useAuthStore()
    auth.token = 'token-1'
    auth.isAuthenticated = true
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [{
      content_id: 'video-1', module: 'video', title: '未看完的视频', path: '/videos/watch/video-1',
      cover_url: '', position_sec: 40, duration_sec: 100, progress: 0.4, updated_at: '2026-07-18T00:00:00Z',
    }] })))

    const wrapper = mount(ContentContinueSection, {
      props: { module: 'video' },
      global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : to.path"><slot /></a>' } } },
    })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/content/continue?module=video&limit=6', expect.any(Object))
    expect(wrapper.text()).toContain('继续观看')
    expect(wrapper.text()).toContain('未看完的视频')
    expect(wrapper.text()).toContain('40%')
    expect(wrapper.get('a').attributes('href')).toBe('/videos/watch/video-1')
  })
})
