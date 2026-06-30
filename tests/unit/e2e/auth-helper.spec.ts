import { describe, expect, it, vi } from 'vitest'
import { loginViaAPI } from '../../../tests/e2e/helpers/auth'

describe('loginViaAPI', () => {
  it('fails when relative API login fails instead of falling back to localhost backend', async () => {
    const failedResponse = {
      ok: () => false,
      json: vi.fn(),
    }
    const fallbackSuccessResponse = {
      ok: () => true,
      json: vi.fn(async () => ({ token: 'token', user: {} })),
    }
    const request = {
      post: vi.fn().mockResolvedValueOnce(failedResponse).mockResolvedValueOnce(fallbackSuccessResponse),
    }

    await expect(loginViaAPI(request as any)).rejects.toThrow()

    expect(request.post).toHaveBeenCalledTimes(1)
    expect(request.post).toHaveBeenCalledWith('/api/v1/auth/login', {
      data: { username: 'admin@atoman.com', password: 'admin123' },
    })
  })
})
