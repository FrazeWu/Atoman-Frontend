import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import OAuthBrandIcon from '@/components/auth/OAuthBrandIcon.vue'
import type { OAuthProvider } from '@/services/oauth'

describe('OAuthBrandIcon', () => {
  it.each<OAuthProvider>(['google', 'github', 'microsoft'])(
    'uses one shared optical canvas for %s',
    (provider) => {
      const wrapper = mount(OAuthBrandIcon, { props: { provider } })

      expect(wrapper.get('svg').attributes('viewBox')).toBe('0 0 24 24')
      expect(wrapper.get('svg').classes()).toContain(`oauth-brand-icon--${provider}`)
      expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
    },
  )

  it('renders the official four-color Google mark', () => {
    const wrapper = mount(OAuthBrandIcon, { props: { provider: 'google' } })

    expect(wrapper.findAll('path').map(path => path.attributes('fill'))).toEqual([
      '#4285F4',
      '#34A853',
      '#FBBC05',
      '#EA4335',
    ])
  })

  it('renders the official four-color Microsoft mark', () => {
    const wrapper = mount(OAuthBrandIcon, { props: { provider: 'microsoft' } })

    expect(wrapper.findAll('path').map(path => path.attributes('fill'))).toEqual([
      '#F25022',
      '#7FBA00',
      '#00A4EF',
      '#FFB900',
    ])
  })

  it('lets the GitHub mark follow the current text theme', () => {
    const wrapper = mount(OAuthBrandIcon, { props: { provider: 'github' } })

    expect(wrapper.get('path').attributes('fill')).toBe('currentColor')
    expect(wrapper.get('svg').attributes('style')).toBeUndefined()
  })
})
