import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSiteAccessStore } from '@/stores/siteAccess'

describe('site access store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetch).mockReset()
  })

  it('loads public site access from the site access endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ modules: {} }), { status: 200 }))

    const store = useSiteAccessStore()
    await store.load()

    expect(fetch).toHaveBeenCalledWith('/api/v1/site/access')
    expect(fetch).not.toHaveBeenCalledWith('/api/v1/settings/public/site-access')
  })
})
