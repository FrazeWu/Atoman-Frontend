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
    isSubscribedToChannel: vi.fn().mockResolvedValue(false),
    subscribeToChannel: vi.fn().mockResolvedValue(true),
    unsubscribeFromChannel: vi.fn().mockResolvedValue(true),
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
      url: '/api/v1',
      blog: {
        channels: '/blog/channels',
        posts: '/blog/posts',
      },
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
    if (url === '/blog/channels?user_id=linmo-id') {
      return { ok: true, data: { data: [
        { id: 'channel-a', user_id: 'linmo-id', name: '设计观察', slug: 'design', description: '博客与视频', cover_url: '' },
        { id: 'channel-anonymous', user_id: '', name: '其他频道', slug: 'other', description: '不应显示', cover_url: '' },
      ] } }
    }
    if (url.startsWith('/blog/posts?user_id=linmo-id')) {
      return { ok: true, data: { data: [{ id: 'post-a', user_id: 'linmo-id', title: '一篇文章', content: '正文', status: 'published', visibility: 'public', pinned: false, created_at: '2026-09-07T08:00:00Z', updated_at: '2026-09-07T08:00:00Z' }] } }
    }
    if (url === '/api/v1/videos?channel_id=channel-a&limit=12') {
      return { ok: true, data: [{ id: 'video-a', user_id: 'linmo-id', title: '一个视频', description: '视频简介', thumbnail_url: '', created_at: '2026-09-07T07:00:00Z' }] }
    }
    if (url === '/api/v1/podcast/shows/design/episodes') {
      return { ok: true, data: { episodes: [{ id: 'episode-a', channel_id: 'channel-a', post: { id: 'post-podcast', user_id: 'linmo-id', title: '一期播客', summary: '播客简介', published_at: '2026-09-07T06:00:00Z' }, episode_cover_url: '', created_at: '2026-09-07T06:00:00Z' }] } }
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

  it('renders the profile identity, owned channels, and mixed content sections', async () => {
    const wrapper = await mountProfile()

    expect(wrapper.text()).toContain('林默')
    expect(wrapper.text()).toContain('信誉分')
    expect(wrapper.text()).toContain('贡献分')
    expect(wrapper.text()).toContain('订阅RSS')
    expect(wrapper.text()).toContain('设计观察')
    expect(wrapper.text()).toContain('一篇文章')
    expect(wrapper.text()).toContain('一个视频')
    expect(wrapper.text()).toContain('一期播客')
    expect(wrapper.findAll('.profile-channel-card')).toHaveLength(1)
    expect(wrapper.find('.profile-channel-card__subscribe').exists()).toBe(true)
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
