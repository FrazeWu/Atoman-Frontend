import { describe, expect, it, vi } from 'vitest'
import { resolveMusicRedirect } from '@/utils/musicRedirect'

describe('resolveMusicRedirect', () => {
  it('follows redirects up to an open target', async () => {
    const load = vi.fn(async (id: string) => ({
      id,
      entry_status: id === 'target' ? 'open' : 'closed',
      redirect_to: id === 'source' ? 'middle' : id === 'middle' ? 'target' : null,
    }))

    const result = await resolveMusicRedirect('source', load)

    expect(result.entity.id).toBe('target')
    expect(result.redirected).toBe(true)
  })

  it('stops redirect cycles without loading forever', async () => {
    const load = vi.fn(async (id: string) => ({
      id,
      entry_status: 'closed',
      redirect_to: id === 'a' ? 'b' : 'a',
    }))

    const result = await resolveMusicRedirect('a', load)

    expect(result.entity.id).toBe('b')
    expect(result.redirected).toBe(false)
    expect(load).toHaveBeenCalledTimes(2)
  })
})
