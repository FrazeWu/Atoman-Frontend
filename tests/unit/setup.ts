import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'

const storage = new Map<string, string>()
const createUnmockedFetch = () => vi.fn(async (input: RequestInfo | URL) => {
	throw new Error(`未 mock fetch: ${String(input)}`)
})

vi.stubGlobal('localStorage', {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => {
		storage.set(key, value)
	},
	removeItem: (key: string) => {
		storage.delete(key)
	},
	clear: () => {
		storage.clear()
	},
})

vi.stubGlobal('fetch', createUnmockedFetch())
vi.stubGlobal('scrollTo', vi.fn())

beforeEach(() => {
	storage.clear()
	vi.stubGlobal('fetch', createUnmockedFetch())
})
