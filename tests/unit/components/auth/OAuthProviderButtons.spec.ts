import { flushPromises, mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import OAuthProviderButtons from '@/components/auth/OAuthProviderButtons.vue'
import { listOAuthProviders } from '@/services/oauth'

vi.mock('@/services/oauth', () => ({
  oauthProviders: ['google', 'github', 'microsoft'],
  oauthProviderLabels: {
    google: 'Google', github: 'GitHub', microsoft: 'Microsoft',
  },
  listOAuthProviders: vi.fn(),
  oauthStartURL: (provider: string, options: { purpose: string; returnTo: string }) =>
    `/api/v1/auth/oauth/${provider}/start?purpose=${options.purpose}&return_to=${encodeURIComponent(options.returnTo)}`,
}))

const componentSource = readFileSync(
  resolve(__dirname, '../../../../src/components/auth/OAuthProviderButtons.vue'),
  'utf8',
)

describe('OAuthProviderButtons', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    vi.mocked(listOAuthProviders).mockResolvedValue(['google', 'github', 'microsoft'])
  })

  it('renders configured providers as accessible authorization links', async () => {
    const wrapper = mount(OAuthProviderButtons, { props: { returnTo: '/forum' } })
    await flushPromises()

    const buttons = wrapper.findAll(
      '[data-test^="oauth-provider-"]:not([data-test="oauth-provider-list"]):not([data-test^="oauth-provider-item-"])',
    )
    expect(buttons).toHaveLength(3)
    expect(wrapper.get('[data-test="oauth-provider-google"]').attributes()).toMatchObject({
      href: '/api/v1/auth/oauth/google/start?purpose=login&return_to=%2Fforum',
      'aria-label': '使用 Google 继续',
    })
    expect(wrapper.text()).toContain('Microsoft')
  })

  it('keeps the product provider order regardless of the API response order', async () => {
    vi.mocked(listOAuthProviders).mockResolvedValue(['microsoft', 'github', 'google'])
    const wrapper = mount(OAuthProviderButtons)
    await flushPromises()

    const labels = wrapper
      .findAll('[data-test^="oauth-provider-"]:not([data-test="oauth-provider-list"]):not([data-test^="oauth-provider-item-"])')
      .map(button => button.text())

    expect(labels).toEqual(['Google', 'GitHub', 'Microsoft'])
  })

  it('marks and remembers the most recently selected provider', async () => {
    localStorage.setItem('atoman_oauth_last_provider', 'github')
    const wrapper = mount(OAuthProviderButtons)
    await flushPromises()

    expect(wrapper.get('[data-test="oauth-provider-item-github"]').text()).toContain('最近使用')
    expect(wrapper.get('[data-test="oauth-provider-github"]').attributes('aria-label')).toBe('使用 GitHub 继续，最近使用')

    wrapper.get('[data-test="oauth-provider-google"]').element.addEventListener('click', event => event.preventDefault())
    await wrapper.get('[data-test="oauth-provider-google"]').trigger('click')

    expect(localStorage.getItem('atoman_oauth_last_provider')).toBe('google')
    expect(wrapper.get('[data-test="oauth-provider-item-google"]').text()).toContain('最近使用')
    expect(wrapper.get('[data-test="oauth-provider-item-github"]').text()).not.toContain('最近使用')
  })

  it('keeps providers available when browser storage is blocked', async () => {
    const getItem = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError')
    })

    const wrapper = mount(OAuthProviderButtons)
    await flushPromises()

    expect(getItem).toHaveBeenCalled()
    expect(wrapper.findAll('[data-test^="oauth-provider-item-"]')).toHaveLength(3)
  })

  it('keeps provider selection usable when browser storage cannot be written', async () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError')
    })
    const wrapper = mount(OAuthProviderButtons)
    await flushPromises()

    wrapper.get('[data-test="oauth-provider-google"]').element.addEventListener('click', event => event.preventDefault())
    await wrapper.get('[data-test="oauth-provider-google"]').trigger('click')

    expect(setItem).toHaveBeenCalledWith('atoman_oauth_last_provider', 'google')
    expect(wrapper.get('[data-test="oauth-provider-item-google"]').text()).toContain('最近使用')
  })

  it('uses a three-column provider row with a narrow-container fallback', () => {
    expect(componentSource).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));')
    expect(componentSource).toContain('container-type: inline-size;')
    expect(componentSource).toContain('@container (max-width: 17rem)')
  })

  it('uses two balanced columns while only two providers are configured', async () => {
    vi.mocked(listOAuthProviders).mockResolvedValue(['github', 'google'])
    const wrapper = mount(OAuthProviderButtons)
    await flushPromises()

    expect(wrapper.get('[data-test="oauth-provider-list"]').classes()).toContain('oauth-providers__grid--2')
    expect(componentSource).toContain('.oauth-providers__grid--2')
    expect(componentSource).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));')
  })

  it('stays hidden when no provider is configured', async () => {
    vi.mocked(listOAuthProviders).mockResolvedValue([])
    const wrapper = mount(OAuthProviderButtons)
    await flushPromises()

    expect(wrapper.find('[data-test="oauth-provider-list"]').exists()).toBe(false)
  })

  it('shows a retry action when provider loading fails', async () => {
	vi.mocked(listOAuthProviders).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(['google'])
	const wrapper = mount(OAuthProviderButtons)
	await flushPromises()
	expect(wrapper.get('[data-test="oauth-provider-error"]').text()).toContain('其他登录方式暂不可用')
	await wrapper.get('[data-test="oauth-provider-retry"]').trigger('click')
	await flushPromises()
	expect(listOAuthProviders).toHaveBeenCalledTimes(2)
	expect(wrapper.find('[data-test="oauth-provider-google"]').exists()).toBe(true)
  })
})
