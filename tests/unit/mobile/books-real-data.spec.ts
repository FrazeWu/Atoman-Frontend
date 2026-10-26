import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BooksShelfView from '@/../apps/mobile/views/books/BooksShelfView.vue'
import BooksNotesView from '@/../apps/mobile/views/books/BooksNotesView.vue'
import BooksMeView from '@/../apps/mobile/views/books/BooksMeView.vue'
import MGuestCard from '@/../apps/mobile/components/ui/MGuestCard.vue'
import { useAuthStore } from '@/stores/auth'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  useRoute: () => ({ query: {} }),
  RouterLink: {
    template: '<a><slot /></a>',
  },
}))

import { listLibrary, listPrivateNotes, readingStatistics, readingRecommendation, deletePrivateNote } from '@/api/bookPrivate'
import { getCloudReadingState } from '@/api/bookReading'

vi.mock('@/api/bookReading', () => ({ getCloudReadingState: vi.fn() }))

vi.mock('@/api/bookPrivate', () => ({
  listLibrary: vi.fn(),
  listPrivateNotes: vi.fn(),
  deletePrivateNote: vi.fn(),
  readingStatistics: vi.fn(),
  readingRecommendation: vi.fn(),
}))

describe('Books Mobile Real Data Wiring', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    mockPush.mockReset()
    vi.spyOn(useAuthStore(), 'restoreSession').mockResolvedValue(true)

    vi.mocked(readingRecommendation).mockResolvedValue({ work_id: 'w-1', available: true, asset: { id: 'asset-real-1', format: 'epub' }, revision_id: 'rev-real-1', source: 'selection' } as any)
    vi.mocked(getCloudReadingState).mockResolvedValue({ current_percent: 0.45 } as any)

    vi.mocked(listLibrary).mockResolvedValue({
      items: [
        { id: 'lib-1', work_id: 'w-1', work_title: '局外人', status: 'reading', version: 1, tags: [] },
        { id: 'lib-2', work_id: 'w-2', work_title: '鼠疫', status: 'read', version: 1, tags: [] },
      ],
      total: 2,
    })

    vi.mocked(listPrivateNotes).mockResolvedValue({
      items: [
        {
          id: 'note-real-1',
          work_id: 'w-1',
          title: '西西弗神话',
          body: '应该设想西西弗是幸福的。',
          version: 1,
          tags: [],
        },
      ],
      total: 1,
    })

    vi.mocked(readingStatistics).mockResolvedValue({
      timezone: 'UTC',
      from: '',
      to: '',
      days: [],
      works: [],
      total_seconds: 7200,
    })
  })

  it('renders real reading progress and shelf books in BooksShelfView', async () => {
    const authStore = useAuthStore()
    authStore.token = 'auth-token'
    authStore.isAuthenticated = true

    const wrapper = mount(BooksShelfView, {
      global: { plugins: [pinia] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('鼠疫')
    expect(wrapper.text()).toContain('45%')
    expect(wrapper.text()).toContain('局外人')
    await wrapper.get('[data-testid="current-reading-card"]').trigger('click')
    await flushPromises()
    expect(mockPush).toHaveBeenCalledWith('/books/read/w-1/asset-real-1/rev-real-1')
    wrapper.unmount()
  })

  it('keeps the shelf visible when progress fails and reports the error', async () => {
    vi.spyOn(useAuthStore(), 'restoreSession').mockResolvedValue(true)
    vi.mocked(getCloudReadingState).mockRejectedValueOnce(new Error('offline'))
    const wrapper = mount(BooksShelfView, { global: { plugins: [pinia] } })
    await flushPromises()
    expect(wrapper.text()).toContain('局外人')
    expect(wrapper.get('[role="alert"]').text()).toContain('加载失败')
    wrapper.unmount()
  })

  it('renders real private notes in BooksNotesView', async () => {
    const authStore = useAuthStore()
    authStore.token = 'auth-token'
    authStore.isAuthenticated = true

    const wrapper = mount(BooksNotesView, {
      global: { plugins: [pinia] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('应该设想西西弗是幸福的')

    const deleteBtn = wrapper.find('[data-testid="note-delete-btn-note-real-1"]')
    await deleteBtn.trigger('click')
    expect(wrapper.text()).not.toContain('应该设想西西弗是幸福的')
    expect(deletePrivateNote).toHaveBeenCalledWith({ id: 'note-real-1', version: 1 })
  })

  it('renders MGuestCard in BooksNotesView when unauthenticated', async () => {
    const authStore = useAuthStore()
    authStore.token = null
    authStore.isAuthenticated = false
    authStore.user = null

    const wrapper = mount(BooksNotesView, {
      global: { plugins: [pinia] },
    })
    await flushPromises()

    expect(wrapper.findComponent(MGuestCard).exists()).toBe(true)
    expect(wrapper.text()).toContain('登录查看书摘笔记')
  })

  it('renders MGuestCard in BooksMeView when unauthenticated', async () => {
    const authStore = useAuthStore()
    authStore.token = null
    authStore.isAuthenticated = false
    authStore.user = null

    const wrapper = mount(BooksMeView, {
      global: { plugins: [pinia] },
    })
    await flushPromises()

    expect(wrapper.findComponent(MGuestCard).exists()).toBe(true)
    expect(wrapper.text()).toContain('登录')
  })

  it('renders real reading stats and user info in BooksMeView when authenticated', async () => {
    const authStore = useAuthStore()
    authStore.token = 'auth-token'
    authStore.isAuthenticated = true
    authStore.user = {
      id: 88,
      uuid: 'user-88',
      username: 'camus_reader',
      display_name: '加缪读者',
      bio: '在荒谬中寻找反抗',
      role: 'user',
    }

    const wrapper = mount(BooksMeView, {
      global: { plugins: [pinia] },
    })
    await flushPromises()

    expect(wrapper.findComponent(MGuestCard).exists()).toBe(false)
    expect(wrapper.text()).toContain('加缪读者')
    expect(wrapper.text()).toContain('1') // 1 reading
    expect(wrapper.text()).toContain('1') // 1 read
  })
})
