import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MusicArchivedView from '@/views/music/MusicArchivedView.vue'

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, user: { role: 'admin' } as { role: string } | null },
  list: vi.fn(),
  restore: vi.fn(),
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/api/musicV1', () => ({ listArchivedMusicEntries: mocks.list, restoreArchivedMusicEntry: mocks.restore }))
vi.mock('@/components/music/MusicArchiveConfirm.vue', () => ({
  default: { props: ['show', 'title', 'restore'], emits: ['confirm', 'cancel'], template: '<div v-if="show"><button data-testid="confirm-restore" @click="$emit(\'confirm\', \'QA restore\')">confirm</button></div>' },
}))

beforeEach(() => {
  mocks.auth.isAuthenticated = true
  mocks.auth.user = { role: 'admin' }
  mocks.list.mockReset().mockResolvedValue({ data: [{ id: 'album-1', entity_type: 'album', title: 'Archived Album', reason: 'QA', archived_at: '2026-10-28T00:00:00Z' }], meta: { page: 1, page_size: 20, total: 1, has_more: false } })
  mocks.restore.mockReset().mockResolvedValue(undefined)
})

describe('music archived admin view', () => {
  it('does not request or expose archived content to non-admin viewers', async () => {
    mocks.auth.user = { role: 'user' }
    const wrapper = mount(MusicArchivedView)
    await flushPromises()
    expect(wrapper.text()).toContain('无权访问')
    expect(wrapper.text()).not.toContain('Archived Album')
    expect(mocks.list).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('requests type-filtered pagination from the server, not only current-page items', async () => {
    const wrapper = mount(MusicArchivedView)
    await flushPromises()
    const select = wrapper.get('[data-testid="music-archive-filter"]')
    await select.setValue('song')
    await flushPromises()
    expect(mocks.list).toHaveBeenLastCalledWith(1, 20, 'song')
    wrapper.unmount()
  })
  it('loads the admin list and restores with an audit reason', async () => {
    const wrapper = mount(MusicArchivedView)
    await flushPromises()
    expect(wrapper.text()).toContain('Archived Album')
    const buttons = wrapper.findAll('button')
    const restoreButton = buttons.find(button => button.text() === '恢复')
    expect(restoreButton).toBeDefined()
    await restoreButton!.trigger('click')
    await wrapper.get('[data-testid="confirm-restore"]').trigger('click')
    await flushPromises()
    expect(mocks.restore).toHaveBeenCalledWith('album', 'album-1', 'QA restore')
    expect(mocks.list).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })
})
