import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentNotificationMode from '@/components/content/ContentNotificationMode.vue'
import { useAuthStore } from '@/stores/auth'

describe('ContentNotificationMode', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().token = 'token-1'
  })

  it('loads and saves the source notification mode', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ source_type: 'internal_channel', source_id: 'channel-1', mode: 'all' }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { source_type: 'internal_channel', source_id: 'channel-1', mode: 'daily' } })))
    const wrapper = mount(ContentNotificationMode, { props: { sourceType: 'internal_channel', sourceId: 'channel-1' } })
    await flushPromises()

    expect(wrapper.get('select').element.value).toBe('all')
    await wrapper.get('select').setValue('daily')
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/content/notification-preferences', expect.objectContaining({ method: 'PUT' }))
  })
})
