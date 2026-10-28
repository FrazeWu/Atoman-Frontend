import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PSkeletonCard from '@/components/ui/PSkeletonCard.vue'

describe('PSkeletonCard', () => {
  it('renders aspect ratio wrapper and default text lines', () => {
    const wrapper = mount(PSkeletonCard, {
      props: { aspect: '3/4', lines: 2 },
    })

    expect(wrapper.classes()).toContain('p-skeleton-card')
    const media = wrapper.find('.p-skeleton-card__media')
    expect(media.exists()).toBe(true)
    expect(media.classes()).toContain('p-skeleton-card__media--3-4')

    const textLines = wrapper.findAll('.p-skeleton-card__text')
    expect(textLines.length).toBe(2)
  })

  it('renders bordered variant when specified', () => {
    const wrapper = mount(PSkeletonCard, {
      props: { bordered: true },
    })
    expect(wrapper.classes()).toContain('p-skeleton-card--bordered')
  })
})
