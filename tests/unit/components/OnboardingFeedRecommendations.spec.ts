import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import OnboardingFeedRecommendations from '@/components/onboarding/OnboardingFeedRecommendations.vue'

const recommendations = [
  { id: 'rec-1', feed_source_id: 'source-1', enabled: true, sort_order: 1, title: '阮一峰的网络日志', category: 'blog', rss_url: 'https://www.ruanyifeng.com/blog/atom.xml', cover_url: '', health_status: 'healthy' },
  { id: 'rec-2', feed_source_id: 'source-2', enabled: true, sort_order: 2, title: '少数派', category: 'news', rss_url: 'https://sspai.com/feed', cover_url: '', health_status: 'healthy' },
]

describe('OnboardingFeedRecommendations', () => {
  const mountPanel = () => mount(OnboardingFeedRecommendations, {
    props: { recommendations },
    global: {
      stubs: {
        PPress: {
          props: ['label', 'disabled'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
        },
      },
    },
  })

  it('submits all selected recommendations', async () => {
    const wrapper = mountPanel()
    const sourceButtons = wrapper.findAll('[data-test="onboarding-source"]')
    await sourceButtons[0]?.trigger('click')
    await sourceButtons[1]?.trigger('click')

    expect(wrapper.text()).toContain('订阅 2 个来源')
    await wrapper.get('[data-test="onboarding-subscribe-selected"]').trigger('click')

    expect(wrapper.emitted('subscribe')?.[0]).toEqual([recommendations])
  })

  it('uses row buttons with a visual selected state instead of checkboxes', async () => {
    const wrapper = mountPanel()
    const firstSource = wrapper.findAll('[data-test="onboarding-source"]')[0]!

    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    expect(firstSource.attributes('aria-pressed')).toBe('false')
    expect(firstSource.find('[data-test="onboarding-source-check"]').exists()).toBe(false)

    await firstSource.trigger('click')

    expect(firstSource.attributes('aria-pressed')).toBe('true')
    expect(firstSource.find('[data-test="onboarding-source-check"]').exists()).toBe(true)
  })

  it('shows localized source categories', () => {
    const wrapper = mountPanel()

    expect(wrapper.text()).toContain('博客')
    expect(wrapper.text()).toContain('新闻')
  })

  it('keeps submit disabled until a source is selected and allows skipping', async () => {
    const wrapper = mountPanel()

    expect(wrapper.get('[data-test="onboarding-subscribe-selected"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-test="onboarding-skip"]').trigger('click')

    expect(wrapper.emitted('skip')).toHaveLength(1)
  })

  it('marks failed sources for retry', () => {
    const wrapper = mount(OnboardingFeedRecommendations, {
      props: { recommendations, failedIds: ['rec-2'] },
      global: { stubs: { PPress: true } },
    })

    expect(wrapper.get('[data-test="onboarding-source-status-rec-2"]').text()).toBe('未成功，可重试')
  })
})
