import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ProfileView from '@/views/blog/ProfileView.vue'

const PSheetStub = defineComponent({
  name: 'PSheet',
  props: ['side', 'mode', 'partialWidth'],
  template: '<section data-testid="profile-right-sheet" :data-side="side" :data-mode="mode" :data-partial-width="partialWidth"><slot /></section>',
})

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

function setProfileResponses(privateProfile = false) {
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
            show_relations: true,
            private_profile: privateProfile,
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
          props: { exactContribution: { type: Boolean, default: false } },
          template: '<div class="summary-card" :data-exact-contribution="String(exactContribution)"><span>信誉分 86</span><span>贡献分 1k+</span><slot /></div>',
        },
        PButton: {
          props: ['label', 'to', 'href', 'disabled', 'loading'],
          template: '<button :disabled="disabled || loading"><slot>{{ label }}</slot></button>',
        },
        PClip: { props: ['label'], template: '<button><slot>{{ label }}</slot></button>' },
        PToast: { template: '<div />' },
        PConfirm: { template: '<div />' },
        PSheet: PSheetStub,
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
    expect(wrapper.get('.profile-channel-card__head').exists()).toBe(true)
    expect(wrapper.get('.profile-channel-card__footer').exists()).toBe(true)
    expect(wrapper.find('.profile-channel-card__types').exists()).toBe(false)
    expect(wrapper.find('.profile-channel-card__subscribe').exists()).toBe(true)
		expect(wrapper.get('.summary-card').attributes('data-exact-contribution')).toBe('true')
    expect(wrapper.get('[data-testid="profile-following-count"]').text()).toBe('128')
    expect(wrapper.get('[data-testid="profile-followers-count"]').text()).toBe('1k+')
    expect(wrapper.get('.profile-section__kicker').text()).toBe('CHANNELS')
    expect(wrapper.get('.profile-section__note').text()).toContain('仅显示')
    expect(wrapper.get('.profile-content__filters').exists()).toBe(true)
    expect(wrapper.get('[data-testid="profile-content-filter-all"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('.profile-content-card')).toHaveLength(3)
  })

  it('filters profile content by type without reloading the profile', async () => {
    const wrapper = await mountProfile()

    await wrapper.get('[data-testid="profile-content-filter-video"]').trigger('click')

    expect(wrapper.findAll('.profile-content-card')).toHaveLength(1)
    expect(wrapper.get('.profile-content-card').attributes('data-content-type')).toBe('video')
    expect(wrapper.get('[data-testid="profile-content-filter-video"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="profile-content-filter-all"]').attributes('aria-pressed')).toBe('false')
  })

	it('recognizes nested user ids when filtering owned media', async () => {
    mocks.apiRequestResult.mockImplementation(async (url: string) => {
      if (url === '/users/by-username/linmo') {
        return { ok: true, data: { data: { uuid: 'linmo-id', username: 'linmo', display_name: '林默', show_relations: true } } }
      }
      if (url.startsWith('/blog/channels')) {
        return { ok: true, data: { data: [{ id: 'channel-a', name: '设计观察', slug: 'design', user: { user_id: 'linmo-id' } }] } }
      }
      if (url.startsWith('/blog/posts')) {
        return { ok: true, data: { data: [{ id: 'post-a', title: '一篇文章', user: { user_id: 'linmo-id' }, created_at: '2026-09-07T09:00:00Z' }] } }
      }
      if (url === '/api/v1/videos?channel_id=channel-a&limit=12') {
        return { ok: true, data: { data: [{ id: 'video-a', title: '一个视频', channel: { user_id: 'linmo-id' }, created_at: '2026-09-07T08:00:00Z' }] } }
      }
      if (url === '/api/v1/podcast/shows/design/episodes') {
        return { ok: true, data: { episodes: [{ id: 'episode-a', channel_id: 'channel-a', post: { id: 'post-podcast', title: '一期播客', user: { user_id: 'linmo-id' }, created_at: '2026-09-07T07:00:00Z' }, created_at: '2026-09-07T07:00:00Z' }] } }
      }
      return { ok: true, data: { data: [] } }
    })

    const wrapper = await mountProfile()

    expect(wrapper.findAll('.profile-channel-card')).toHaveLength(1)
		expect(wrapper.findAll('.profile-content-card')).toHaveLength(3)
	})

	it('renders a direct profile response without requiring a data wrapper', async () => {
		mocks.apiRequestResult.mockImplementation(async (url: string) => {
			if (url === '/users/by-username/linmo') {
				return { ok: true, data: { uuid: 'linmo-id', username: 'linmo', display_name: '林默', show_relations: false } }
			}
			return { ok: true, data: [] }
		})

		const wrapper = await mountProfile()

		expect(wrapper.get('.profile-header__name').text()).toBe('林默')
	})

	it('opens a relation modal and deduplicates users in the following list', async () => {
    const wrapper = await mountProfile()

    await wrapper.get('[data-testid="profile-following"]').trigger('click')
    await flushPromises()

    const modal = wrapper.get('[data-testid="profile-relations-modal"]')
    expect(modal.text()).toContain('Alice')
    expect(modal.text()).toContain('Bob')
    expect(modal.text()).toContain('设计观察')
    expect(modal.text().match(/Alice/g)).toHaveLength(1)
    const sheet = wrapper.findComponent(PSheetStub)
    expect(sheet.props('side')).toBe('right')
    expect(sheet.props('mode')).toBe('partial')
  })

	it('opens the relation sheet when the whole relation card is clicked', async () => {
    const wrapper = await mountProfile()

    const followingCard = wrapper.get('[data-testid="profile-following"]')
    expect(followingCard.element.tagName).toBe('BUTTON')

    await followingCard.trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="profile-relations-modal"]').exists()).toBe(true)
	})

	it('uses 用户设置 for the owned profile action', async () => {
    mocks.auth.user = { username: 'linmo', uuid: 'linmo-id' }
    const wrapper = await mountProfile()

    expect(wrapper.get('[data-testid="edit-profile"]').text()).toBe('用户设置')
  })

  it('hides non-identity content on a private profile viewed by another user', async () => {
    setProfileResponses(true)
    const wrapper = await mountProfile()

    expect(wrapper.get('.profile-header__name').text()).toBe('linmo')
    expect(wrapper.find('.profile-header__handle').exists()).toBe(false)
    expect(wrapper.find('.profile-header__action-area').exists()).toBe(false)
    expect(wrapper.find('.summary-card').exists()).toBe(false)
    expect(wrapper.find('.profile-header__bio-row').exists()).toBe(false)
    expect(wrapper.find('.profile-section').exists()).toBe(false)
    expect(mocks.apiRequestResult.mock.calls.some(([url]) => String(url).startsWith('/blog/'))).toBe(false)
  })

  it('keeps profile actions visible without a horizontal scroller at tablet widths', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/blog/ProfileView.vue'), 'utf8')

    expect(source).toMatch(/\.profile-header__action-area\s*\{[\s\S]*?min-width:\s*0/)
    expect(source).not.toMatch(/\.profile-header__actions\s*\{[\s\S]*?overflow-x:\s*auto/)
    expect(source).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.profile-header__identity-row\s*\{[\s\S]*?display:\s*grid/)
    expect(source).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.profile-header__action-area\s*\{[\s\S]*?align-self:\s*stretch/)
  })

  it('stacks profile section headings before their notes and filters on smaller screens', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/blog/ProfileView.vue'), 'utf8')

    expect(source).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.profile-section__heading\s*\{[\s\S]*?flex-direction:\s*column/)
  })

  it('keeps profile actions in one desktop row and only wraps them on narrow screens', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/blog/ProfileView.vue'), 'utf8')

    expect(source).toMatch(/\.profile-header__actions\s*\{[\s\S]*?flex-wrap:\s*nowrap/)
    expect(source).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.profile-header__actions\s*\{[\s\S]*?flex-wrap:\s*wrap/)
  })
})
