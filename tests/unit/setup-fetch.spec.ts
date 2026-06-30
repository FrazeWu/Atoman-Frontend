import { describe, expect, it } from 'vitest'

describe('unit test fetch setup', () => {
	it('rejects unmocked fetch calls with a clear error', async () => {
		await expect(fetch('/api/v1/unmocked')).rejects.toThrow('未 mock fetch')
	})
})
