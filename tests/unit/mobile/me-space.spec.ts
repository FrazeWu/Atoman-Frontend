import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import ProfileMobileView from '@mobile/views/me/ProfileMobileView.vue'
import { useAuthStore } from '@/stores/auth'

describe('ProfileMobileView.vue (Option A - 全站聚合资产与数字生活中心)', () => {
  let pinia: ReturnType<typeof createPinia>
  let router: ReturnType<typeof createRouter>

  const mockUser = {
    username: 'fraze_dev',
    name: 'Fraze',
    avatar: 'https://example.com/avatar.jpg',
    bio: '全栈架构师，保持阅读与思考。',
    stats: {
      articles: 18,
      reading: 4,
      bookmarks: 56,
      followers: 240,
    },
  }

  beforeEach(async () => {
    pinia = createPinia()
    setActivePinia(pinia)

    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/me', component: { template: '<div>Me</div>' } },
        { path: '/posts/me', component: { template: '<div>Posts Me</div>' } },
        { path: '/books/shelf', component: { template: '<div>Books Shelf</div>' } },
        { path: '/feed/starred', component: { template: '<div>Feed Starred</div>' } },
        { path: '/music/me', component: { template: '<div>Music Me</div>' } },
        { path: '/studio', component: { template: '<div>Studio</div>' } },
        { path: '/inbox/notifications', component: { template: '<div>Notifications</div>' } },
        { path: '/login', component: { template: '<div>Login</div>' } },
      ],
    })

    await router.push('/me')
    await router.isReady()
  })

  it('renders user profile card with avatar, name, handle, bio, edit button and public profile link', async () => {
    const wrapper = mount(ProfileMobileView, {
      props: {
        user: mockUser,
      },
      global: {
        plugins: [pinia, router],
      },
    })

    expect(wrapper.find('[data-testid="profile-card"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Fraze')
    expect(wrapper.text()).toContain('@fraze_dev')
    expect(wrapper.text()).toContain('全栈架构师，保持阅读与思考。')
    expect(wrapper.find('[data-testid="edit-profile-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="public-profile-link"]').exists()).toBe(true)
  })

  it('renders 4 multi-space stats boxes with accurate counts and labels', async () => {
    const wrapper = mount(ProfileMobileView, {
      props: {
        user: mockUser,
      },
      global: {
        plugins: [pinia, router],
      },
    })

    const statBoxes = wrapper.findAll('[data-testid="profile-stat-box"]')
    expect(statBoxes.length).toBe(4)

    expect(wrapper.text()).toContain('18')
    expect(wrapper.text()).toContain('作品')
    expect(wrapper.text()).toContain('4')
    expect(wrapper.text()).toContain('在读')
    expect(wrapper.text()).toContain('56')
    expect(wrapper.text()).toContain('收藏')
    expect(wrapper.text()).toContain('240')
    expect(wrapper.text()).toContain('关注者')
  })

  it('renders 4 space footprints cards for quick navigation', async () => {
    const wrapper = mount(ProfileMobileView, {
      props: {
        user: mockUser,
      },
      global: {
        plugins: [pinia, router],
      },
    })

    const footprintCards = wrapper.findAll('[data-testid="footprint-card"]')
    expect(footprintCards.length).toBe(4)

    expect(wrapper.text()).toContain('音乐收听')
    expect(wrapper.text()).toContain('阅读记录')
    expect(wrapper.text()).toContain('创作台')
    expect(wrapper.text()).toContain('收藏队列')
  })

  it('renders settings list, and toggles theme mode upon clicking theme switch', async () => {
    const wrapper = mount(ProfileMobileView, {
      props: {
        user: mockUser,
      },
      global: {
        plugins: [pinia, router],
      },
    })

    const themeToggle = wrapper.find('[data-testid="settings-theme-toggle"]')
    expect(themeToggle.exists()).toBe(true)
    expect(themeToggle.text()).toContain('浅色')

    await themeToggle.trigger('click')
    expect(themeToggle.text()).toContain('深色')
  })

  it('allows editing profile via MSheet drawer and updates state', async () => {
    const wrapper = mount(ProfileMobileView, {
      props: {
        user: mockUser,
      },
      global: {
        plugins: [pinia, router],
      },
    })

    const editBtn = wrapper.find('[data-testid="edit-profile-btn"]')
    await editBtn.trigger('click')

    const sheet = wrapper.find('[data-testid="edit-profile-sheet"]')
    expect(sheet.exists()).toBe(true)

    const nameInput = wrapper.find('[data-testid="edit-name-input"]')
    expect(nameInput.exists()).toBe(true)
    await nameInput.setValue('Fraze Architect')

    const bioInput = wrapper.find('[data-testid="edit-bio-input"]')
    expect(bioInput.exists()).toBe(true)
    await bioInput.setValue('深耕系统设计与用户界面')

    const saveBtn = wrapper.find('[data-testid="edit-save-btn"]')
    await saveBtn.trigger('click')

    expect(wrapper.text()).toContain('Fraze Architect')
    expect(wrapper.text()).toContain('深耕系统设计与用户界面')
  })

  it('clears cache and shows clean state upon clicking cache item', async () => {
    const wrapper = mount(ProfileMobileView, {
      props: {
        user: mockUser,
      },
      global: {
        plugins: [pinia, router],
      },
    })

    const cacheItem = wrapper.find('[data-testid="settings-cache-item"]')
    expect(cacheItem.text()).toContain('12.4 MB')

    await cacheItem.trigger('click')
    expect(cacheItem.text()).toContain('0 KB')
  })

  it('renders logout button and handles logout action', async () => {
    const authStore = useAuthStore()
    vi.spyOn(authStore, 'logout').mockResolvedValue(undefined)
    const pushSpy = vi.spyOn(router, 'push')

    const wrapper = mount(ProfileMobileView, {
      props: {
        user: mockUser,
      },
      global: {
        plugins: [pinia, router],
      },
    })

    const logoutBtn = wrapper.find('[data-testid="logout-btn"]')
    expect(logoutBtn.exists()).toBe(true)
    expect(logoutBtn.text()).toContain('退出登录')

    await logoutBtn.trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/login')
  })
})
