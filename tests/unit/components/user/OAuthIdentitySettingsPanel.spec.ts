import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import OAuthIdentitySettingsPanel from '@/components/user/OAuthIdentitySettingsPanel.vue'
import {
  listOAuthIdentities,
  listOAuthProviders,
  unlinkOAuthIdentity,
} from '@/services/oauth'

vi.mock('@/services/oauth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/oauth')>()
  return {
    ...actual,
    listOAuthProviders: vi.fn(),
    listOAuthIdentities: vi.fn(),
    unlinkOAuthIdentity: vi.fn(),
  }
})

const PConfirmStub = defineComponent({
  props: { show: Boolean },
  emits: ['confirm', 'cancel'],
  template: '<button v-if="show" data-test="confirm-unlink" @click="$emit(\'confirm\')">确认</button>',
})

describe('OAuthIdentitySettingsPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(listOAuthProviders).mockResolvedValue(['google', 'apple', 'github', 'microsoft'])
    vi.mocked(listOAuthIdentities).mockResolvedValue([
      { provider: 'github', email: 'alice@example.com', last_login_at: null },
    ])
    vi.mocked(unlinkOAuthIdentity).mockResolvedValue()
  })

  it('shows linked state and builds account-link URLs', async () => {
    const wrapper = mount(OAuthIdentitySettingsPanel, {
      props: { returnTo: '/users/alice/settings' },
      global: { stubs: { PConfirm: PConfirmStub } },
    })
    await flushPromises()

    expect(wrapper.findAll('[data-test^="oauth-identity-"]')).toHaveLength(4)
    expect(wrapper.get('[data-test="oauth-link-google"]').attributes('href'))
      .toBe('/api/v1/auth/oauth/google/start?purpose=link&return_to=%2Fusers%2Falice%2Fsettings')
    expect(wrapper.get('[data-test="oauth-identity-github"]').text()).toContain('alice@example.com')
  })

  it('confirms before unlinking a provider', async () => {
    const wrapper = mount(OAuthIdentitySettingsPanel, {
      global: { stubs: { PConfirm: PConfirmStub } },
    })
    await flushPromises()

    await wrapper.get('[data-test="oauth-unlink-github"]').trigger('click')
    await wrapper.get('[data-test="confirm-unlink"]').trigger('click')
    await flushPromises()

    expect(unlinkOAuthIdentity).toHaveBeenCalledWith('github')
    expect(wrapper.find('[data-test="oauth-unlink-github"]').exists()).toBe(false)
  })
})
