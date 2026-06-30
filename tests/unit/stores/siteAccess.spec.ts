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

  it('does not mark access as loaded when the public access endpoint fails', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 500 }))

    const store = useSiteAccessStore()

    await expect(store.load()).rejects.toThrow('站点访问配置加载失败')

    expect(store.loaded).toBe(false)
  })

  it('waits for the pending load when load is called concurrently', async () => {
    let resolveFetch!: (response: Response) => void
    vi.mocked(fetch).mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve
    }))

    const store = useSiteAccessStore()
    const firstLoad = store.load()
    const secondLoad = store.load()
    let secondSettled = false
    secondLoad.finally(() => {
      secondSettled = true
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(secondSettled).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(1)

    resolveFetch(new Response(JSON.stringify({
      modules: {
        forum: { enabled: false, features: {} },
      },
    }), { status: 200 }))
    await Promise.all([firstLoad, secondLoad])

    expect(store.isModuleVisible('forum')).toBe(false)
  })
})
