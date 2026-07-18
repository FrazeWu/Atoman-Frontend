import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import OAuthProviderButtons from '@/components/auth/OAuthProviderButtons.vue'
import { listOAuthProviders } from '@/services/oauth'

vi.mock('@/services/oauth', () => ({
  oauthProviderLabels: {
    google: 'Google', github: 'GitHub', microsoft: 'Microsoft',
  },
  listOAuthProviders: vi.fn(),
  oauthStartURL: (provider: string, options: { purpose: string; returnTo: string }) =>
    `/api/v1/auth/oauth/${provider}/start?purpose=${options.purpose}&return_to=${encodeURIComponent(options.returnTo)}`,
}))

describe('OAuthProviderButtons', () => {
  beforeEach(() => {
    vi.mocked(listOAuthProviders).mockResolvedValue(['google', 'github', 'microsoft'])
  })

  it('renders configured providers as accessible authorization links', async () => {
    const wrapper = mount(OAuthProviderButtons, { props: { returnTo: '/forum' } })
    await flushPromises()

    const buttons = wrapper.findAll('[data-test^="oauth-provider-"]:not([data-test="oauth-provider-list"])')
    expect(buttons).toHaveLength(3)
    expect(wrapper.get('[data-test="oauth-provider-google"]').attributes()).toMatchObject({
      href: '/api/v1/auth/oauth/google/start?purpose=login&return_to=%2Fforum',
      'aria-label': '使用 Google 继续',
    })
    expect(wrapper.text()).toContain('Microsoft')
  })

  it('stays hidden when no provider is configured', async () => {
    vi.mocked(listOAuthProviders).mockResolvedValue([])
    const wrapper = mount(OAuthProviderButtons)
    await flushPromises()

    expect(wrapper.find('[data-test="oauth-provider-list"]').exists()).toBe(false)
  })
})
