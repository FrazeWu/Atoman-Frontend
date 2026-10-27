import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { getCatalogWork } from '@/api/bookCatalog'
import { readingRecommendation, listPrivateNotes, deletePrivateNote } from '@/api/bookPrivate'
import BookDetail from '@mobile/views/books/BookDetailMobileView.vue'
import Notes from '@mobile/views/books/BooksNotesView.vue'

vi.mock('@/api/bookCatalog', () => ({ getCatalogWork: vi.fn() }))
vi.mock('@/api/bookPrivate', () => ({ readingRecommendation: vi.fn(), listPrivateNotes: vi.fn(), deletePrivateNote: vi.fn() }))
vi.mock('@/components/books/BookWorkCommunity.vue', () => ({ default: { props: ['workId'], template: '<div data-testid="community">{{ workId }}</div>' } }))
vi.mock('@/components/books/BookShelfAction.vue', () => ({ default: { props: ['workId'], template: '<div data-testid="shelf">{{ workId }}</div>' } }))
let wrapper: VueWrapper | undefined
let pinia: ReturnType<typeof createPinia>
let router: ReturnType<typeof createRouter>
const work = (id = 'book-1') => ({ id, title: 'Actual book ' + id, authors: [{ name: 'Real author' }], editions: [], description: 'Actual description' })
const note = { id: 'note-1', work_id: 'book-1', title: 'Saved note', body: 'Private text', tags: [], version: 7 }

beforeEach(async () => {
  vi.resetAllMocks()
  pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore(); auth.isAuthenticated = true; auth.user = { uuid: 'reader' } as typeof auth.user
  router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/books/work/:id', component: BookDetail }, { path: '/books/read/:id/:asset/:revision', component: { template: '<div />' } },
  ] })
  await router.push('/books/work/book-1')
  vi.mocked(getCatalogWork).mockResolvedValue(work() as never)
  vi.mocked(listPrivateNotes).mockResolvedValue({ items: [note], total: 1 })
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined })

it('does not invent a sample book when the API fails and supports retry', async () => {
  vi.mocked(getCatalogWork).mockRejectedValueOnce(new Error('unavailable'))
  wrapper = mount(BookDetail, { global: { plugins: [router, pinia] } })
  await flushPromises()
  expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  expect(wrapper.find('h1').exists()).toBe(false)
  await wrapper.get('[role="alert"] button').trigger('click'); await flushPromises()
  expect(wrapper.get('h1').text()).toBe('Actual book book-1')
  expect(wrapper.find('.book-detail-mobile__chapters').exists()).toBe(false)
  expect(wrapper.get('[data-testid="shelf"]').text()).toBe('book-1')
})

it('does not navigate to a nonexistent reader when no approved resource exists', async () => {
  vi.mocked(readingRecommendation).mockResolvedValue({ available: false, work_id: 'book-1', source: 'none' })
  wrapper = mount(BookDetail, { global: { plugins: [router, pinia] } }); await flushPromises()
  await wrapper.get('[data-testid="start-reading-btn"]').trigger('click'); await flushPromises()
  expect(router.currentRoute.value.path).toBe('/books/work/book-1')
  expect(wrapper.find('[role="alert"]').exists()).toBe(true)
})

it('ignores stale work responses after route changes', async () => {
  let resolveOld!: (value: unknown) => void
  vi.mocked(getCatalogWork).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve }) as never)
  wrapper = mount(BookDetail, { global: { plugins: [router, pinia] } })
  vi.mocked(getCatalogWork).mockResolvedValue(work('book-2') as never)
  await router.push('/books/work/book-2'); await flushPromises()
  resolveOld(work('book-1')); await flushPromises()
  expect(wrapper.get('h1').text()).toBe('Actual book book-2')
})

it('keeps a private note visible after a failed delete and uses its real version', async () => {
  wrapper = mount(Notes, { global: { plugins: [router, pinia] } }); await flushPromises()
  vi.mocked(deletePrivateNote).mockRejectedValueOnce(new Error('conflict'))
  await wrapper.get('[data-testid="note-delete-btn-note-1"]').trigger('click'); await flushPromises()
  expect(deletePrivateNote).toHaveBeenCalledWith(expect.objectContaining({ id: 'note-1', version: 7 }))
  expect(wrapper.text()).toContain('Private text')
  expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  vi.mocked(deletePrivateNote).mockResolvedValueOnce(undefined)
  await wrapper.get('[data-testid="note-delete-btn-note-1"]').trigger('click'); await flushPromises()
  expect(wrapper.text()).not.toContain('Private text')
})

it('clears private notes when the signed-in account changes', async () => {
  wrapper = mount(Notes, { global: { plugins: [router, pinia] } }); await flushPromises()
  expect(wrapper.text()).toContain('Private text')
  const auth = useAuthStore(); auth.isAuthenticated = false; auth.user = null
  await flushPromises()
  expect(wrapper.text()).not.toContain('Private text')
})
