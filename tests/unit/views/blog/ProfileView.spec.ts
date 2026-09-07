import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ProfileView from '@/views/blog/ProfileView.vue'

const mocks = vi.hoisted(() => ({
  auth: {
    isAuthenticated: true,
    token: 'token',
    user: { username: 'viewer', uuid: 'viewer-id' },
    updateUser: vi.fn(),
  },
  apiRequestResult: vi.fn(),
  apiRequestEnvelope: vi.fn(),
  fetchBookmarkedPostIds: vi.fn(),
  fetchReadingListIds: vi.fn(),
  togglePostBookmark: vi.fn(),
  toggleReadingListItem: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  apiRequestResult: mocks.apiRequestResult,
  apiRequestEnvelope: mocks.apiRequestEnvelope,
}))

vi.mock('@/stores/auth', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/stores/feed', () => ({
  useFeedStore: () => ({
    bookmarkedPostIds: new Set<string>(),
    readingListItemIds: new Set<string>(),
    fetchBookmarkedPostIds: mocks.fetchBookmarkedPostIds,
    fetchReadingListIds: mocks.fetchReadingListIds,
    togglePostBookmark: mocks.togglePostBookmark,
    toggleReadingListItem: mocks.toggleReadingListItem,
  }),
}))
vi.mock('@/composables/useApi', () => ({
  useApi: () => ({
    users: {
      profile: (username: string) => `/users/by-username/${username}`,
      following: (id: string) => `/users/${id}/following`,
      followers: (id: string) => `/users/${id}/followers`,
      follow: (id: string) => `/users/${id}/follow`,
      settings: '/users/me',
    },
    rss: { user: (username: string) => `/rss/users/${username}.xml` },
    site: { resolve: (handle: string) => `/site/resolve/${handle}` },
    blog: {},
  }),
}))
vi.mock('@/router/siteContext', () => ({
  resolveSiteContext: () => ({ type: 'root' }),
}))
vi.mock('@/composables/useBlogSheets', () => ({ useBlogSheets: () => ({ openPost: vi.fn() }) }))
vi.mock('@/api/userProfile', () => ({
  getUserAvatarRestoreAvailability: vi.fn().mockResolvedValue({ available: false }),
  restoreUserAvatar: vi.fn(),
  uploadUserAvatar: vi.fn(),
}))

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/users/:handle', component: ProfileView }],
  })
}

function setProfileResponses() {
  mocks.apiRequestResult.mockImplementation(async (url: string) => {
    if (url === '/users/by-username/linmo') {
      return {
        ok: true,
        data: {
          data: {
            uuid: 'linmo-id',
            username: 'linmo',
            display_name: '林默',
            bio: '记录产品与技术。',
            followers_count: 1234,
            following_count: 128,
            quality: 86,
            contribution_total: 1800,
          },
        },
      }
    }
    if (url === '/users/linmo-id/following') {
      return {
        ok: true,
        data: {
          data: [
            { uuid: 'account-a', username: 'alice', display_name: 'Alice', email: 'a@example.com' },
            { uuid: 'account-a', username: 'alice', display_name: 'Alice', email: 'a@example.com' },
            { kind: 'channel', id: 'channel-a', name: '设计观察', owner: { uuid: 'account-a', username: 'alice', display_name: 'Alice' } },
            { uuid: 'account-b', username: 'bob', display_name: 'Bob', email: 'b@example.com' },
          ],
        },
      }
    }
    if (url === '/users/linmo-id/followers') {
      return { ok: true, data: { data: [] } }
    }
    return { ok: true, data: { data: [] } }
  })
}

async function mountProfile() {
  const router = makeRouter()
  await router.push('/users/linmo')
  await router.isReady()
  const wrapper = mount(ProfileView, {
    global: {
      plugins: [router],
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        ChannelView: { template: '<div />' },
        UserSummaryCard: {
          template: '<div class="summary-card"><span>信誉分 86</span><span>贡献分 1.8k</span><slot /></div>',
        },
        PButton: {
          props: ['label', 'to', 'href', 'disabled', 'loading'],
          template: '<button :disabled="disabled || loading"><slot>{{ label }}</slot></button>',
        },
        PClip: { props: ['label'], template: '<button><slot>{{ label }}</slot></button>' },
        PToast: { template: '<div />' },
        PConfirm: { template: '<div />' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('ProfileView', () => {
  beforeEach(() => {
    mocks.apiRequestResult.mockReset()
    mocks.apiRequestEnvelope.mockReset()
    mocks.auth.isAuthenticated = true
    mocks.auth.user = { username: 'viewer', uuid: 'viewer-id' }
    setProfileResponses()
  })

  it('renders the compact identity layout without channels or content sections', async () => {
    const wrapper = await mountProfile()

    expect(wrapper.text()).toContain('林默')
    expect(wrapper.text()).toContain('信誉分')
    expect(wrapper.text()).toContain('贡献分')
    expect(wrapper.text()).toContain('订阅RSS')
    expect(wrapper.text()).not.toContain('个频道')
    expect(wrapper.text()).not.toContain('暂无内容')
    expect(wrapper.get('[data-testid="profile-following-count"]').text()).toBe('128')
    expect(wrapper.get('[data-testid="profile-followers-count"]').text()).toBe('1k+')
  })

  it('opens a relation modal and deduplicates users in the following list', async () => {
    const wrapper = await mountProfile()

    await wrapper.get('[data-testid="profile-following"]').trigger('click')
    await flushPromises()

    const modal = document.body.querySelector('[data-testid="profile-relations-modal"]')
    expect(modal).not.toBeNull()
    expect(modal?.textContent).toContain('Alice')
    expect(modal?.textContent).toContain('Bob')
    expect(modal?.textContent).toContain('设计观察')
    expect(modal?.textContent?.match(/Alice/g)).toHaveLength(1)
  })
})
