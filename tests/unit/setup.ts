import '@testing-library/jest-dom/vitest'

const storage = new Map<string, string>()

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

vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
vi.stubGlobal('scrollTo', vi.fn())
