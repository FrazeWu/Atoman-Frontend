import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import RatingControl from '@/components/shared/RatingControl.vue'

const ratingControlSource = readFileSync(
  resolve(process.cwd(), 'src/components/shared/RatingControl.vue'),
  'utf8',
)

describe('RatingControl.vue', () => {
  it('shows a public ten-point average from the fifth rating onward', () => {
    const wrapper = mount(RatingControl, {
      props: { ratingScore: 8.6, ratingCount: 5 },
    })

    expect(wrapper.get('.rating-control__public-score').text()).toBe('8.6 / 10')
    expect(wrapper.text()).toContain('5 人')
  })

  it('hides the average and explains the threshold below five ratings', () => {
    const wrapper = mount(RatingControl, {
      props: { ratingScore: 10, ratingCount: 4 },
    })

    expect(wrapper.find('.rating-control__public-score').exists()).toBe(false)
    expect(wrapper.text()).toContain('评分人数不足（4/5）')
  })

  it('uses solid gray base stars and orange-gold fills', () => {
    const wrapper = mount(RatingControl)
    const baseStarRule = ratingControlSource.match(
      /\.rating-control__star-base\s*\{([^}]*)\}/s,
    )?.[1] ?? ''
    const fillRule = [...ratingControlSource.matchAll(
      /\.rating-control__star-fill\s*\{([^}]*)\}/gs,
    )].map((match) => match[1]).find((rule) => rule.includes('overflow: hidden')) ?? ''

    expect(wrapper.findAll('.rating-control__star-base')).toHaveLength(5)
    expect(wrapper.findAll('.rating-control__star-fill')).toHaveLength(5)
    expect(baseStarRule).toMatch(/color:\s*var\(--a-color-border\)/)
    expect(fillRule).toMatch(/color:\s*var\(--a-color-warning\)/)
  })

  it('emits integer ten-point scores from half-star targets', async () => {
    const wrapper = mount(RatingControl)
    const scoreNine = wrapper.get('button[data-score="9"]')

    expect(wrapper.findAll('.rating-control__score-target')).toHaveLength(10)
    expect(scoreNine.attributes('aria-label')).toBe('9 分，4.5 星')
    await scoreNine.trigger('click')

    expect(wrapper.emitted('rate')).toEqual([[9]])
  })

  it('keeps half-star and whole-star targets in place while hovering', async () => {
    const wrapper = mount(RatingControl)
    const scoreThree = wrapper.get('button[data-score="3"]')
    const scoreTargetRule = ratingControlSource.match(
      /\.rating-control__score-target\s*\{([^}]*)\}/s,
    )?.[1] ?? ''

    expect(scoreTargetRule).toMatch(/appearance:\s*none/)
    expect(scoreTargetRule).toMatch(/transform:\s*none/)
    expect(scoreTargetRule).toMatch(/transition:\s*none/)

    await scoreThree.trigger('mouseenter')

    expect(wrapper.findAll('.rating-control__score-target')).toHaveLength(10)
    expect(wrapper.get('.rating-control__preview').text()).toContain('1.5 星')
  })

  it('only changes the stars while hovering in compact mode', async () => {
    const wrapper = mount(RatingControl, { props: { size: 'compact' } })

    await wrapper.get('button[data-score="10"]').trigger('mouseenter')

    expect(wrapper.find('.rating-control__preview').exists()).toBe(false)
    expect(wrapper.get('.rating-control__star-fill').attributes('style')).toContain('width: 16px')
  })

  it('moves one point at a time with the keyboard', async () => {
    const wrapper = mount(RatingControl)

    await wrapper.get('button[data-score="8"]').trigger('keydown', { key: 'ArrowRight' })

    expect(wrapper.emitted('rate')).toEqual([[9]])
  })

  it('shows the saved personal score below the public threshold and allows clearing it', async () => {
    const wrapper = mount(RatingControl, {
      props: { viewerRating: 9 },
    })

    expect(wrapper.get('.rating-control__mine').text()).toContain('我的评分：9/10 · 4.5 星（已保存）')
    await wrapper.get('.rating-control__clear').trigger('click')

    expect(wrapper.emitted('clear')).toEqual([[]])
  })

  it('keeps compact ratings to star fills without hover or personal-rating text', async () => {
    const wrapper = mount(RatingControl, {
      props: { size: 'compact', viewerRating: 9 },
    })

    expect(wrapper.find('.rating-control__mine').exists()).toBe(false)
    expect(wrapper.findAll('.rating-control__star-fill')).toHaveLength(5)

    await wrapper.get('button[data-score="3"]').trigger('mouseenter')

    expect(wrapper.find('.rating-control__preview').exists()).toBe(false)
    expect(wrapper.find('.rating-control__mine').exists()).toBe(false)
    expect(wrapper.findAll('.rating-control__star-fill').map((star) => (star.element as HTMLElement).style.width)).toEqual([
      '16px',
      '8px',
      '0px',
      '0px',
      '0px',
    ])
  })

  it('centers compact star fills on the smaller star outline', () => {
    const wrapper = mount(RatingControl, {
      props: { size: 'compact', viewerRating: 1 },
    })

    expect(wrapper.get('.rating-control__star-fill').attributes('style')).toContain('left: calc(50% - 8px)')
  })

  it('keeps compact controls to a fixed summary-and-stars slot', () => {
    const wrapper = mount(RatingControl, {
      props: { size: 'compact', viewerRating: 7, disabled: false },
    })
    const compactRule = ratingControlSource.match(
      /\.rating-control--compact\s*\{([^}]*)\}/s,
    )?.[1] ?? ''

    expect(wrapper.find('.rating-control__meta').exists()).toBe(false)
    expect(wrapper.find('.rating-control__clear').exists()).toBe(true)
    expect(compactRule).toMatch(/display:\s*grid/)
    expect(compactRule).toMatch(/width:\s*20\.75rem/)
    expect(compactRule).toMatch(/flex:\s*0 0 20\.75rem/)
  })

  it('announces save errors beside the control', () => {
    const wrapper = mount(RatingControl, {
      props: { errorMessage: '评分未保存，请重试' },
    })

    expect(wrapper.get('.rating-control__error').attributes('role')).toBe('alert')
  })

  it('invites the first rating and hides the average again when five becomes four', async () => {
    const wrapper = mount(RatingControl)
    expect(wrapper.text()).toContain('暂无评分，成为第一个评分者')
    await wrapper.setProps({ ratingScore: 8, ratingCount: 5, viewerRating: 7 })
    expect(wrapper.find('.rating-control__public-score').exists()).toBe(true)
    await wrapper.setProps({ ratingCount: 4 })
    expect(wrapper.find('.rating-control__public-score').exists()).toBe(false)
    expect(wrapper.get('.rating-control__mine').text()).toContain('7/10')
  })

  it('announces saving and rejects keyboard submissions while busy', async () => {
    const wrapper = mount(RatingControl, { props: { loading: true } })
    expect(wrapper.get('[role="status"]').text()).toContain('正在保存')
    await wrapper.get('button[data-score="8"]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('rate')).toBeUndefined()
  })

  it('keeps keyboard focus while saving so arrow keys can continue rating', async () => {
    const wrapper = mount(RatingControl)
    document.body.appendChild(wrapper.element)
    const seven = wrapper.get<HTMLButtonElement>('button[data-score="7"]')
    seven.element.focus()
    await seven.trigger('keydown', { key: 'ArrowRight' })
    const eight = wrapper.get<HTMLButtonElement>('button[data-score="8"]')
    expect(document.activeElement).toBe(eight.element)
    await wrapper.setProps({ loading: true })
    expect(eight.attributes('aria-disabled')).toBe('true')
    expect(eight.element.disabled).toBe(false)
    await eight.trigger('click')
    expect(wrapper.emitted('rate')).toEqual([[8]])
    await wrapper.setProps({ loading: false, viewerRating: 8 })
    expect(document.activeElement).toBe(eight.element)
    await eight.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('rate')).toEqual([[8], [9]])
    wrapper.element.remove()
    wrapper.unmount()
  })
})


it('honors the six-reader book policy and explicit inactive aggregates', async () => {
  const wrapper = mount(RatingControl, { props: { ratingScore: 8, ratingCount: 5, minimumRatingCount: 6 } })
  expect(wrapper.find('.rating-control__public-score').exists()).toBe(false)
  expect(wrapper.text()).toContain('5/6')
  await wrapper.setProps({ ratingCount: 6, ratingActive: false })
  expect(wrapper.find('.rating-control__public-score').exists()).toBe(false)
  await wrapper.setProps({ ratingActive: true })
  expect(wrapper.get('.rating-control__public-score').text()).toBe('8.0 / 10')
  wrapper.unmount()
})


it('shows an optional reference mean without activating the official score', () => {
  const wrapper = mount(RatingControl, { props: { ratingScore: 9, ratingCount: 2, minimumRatingCount: 6, showReferenceScore: true, ratingActive: false } })
  expect(wrapper.find('.rating-control__public-score').exists()).toBe(false)
  expect(wrapper.get('.rating-control__reference-score').text()).toContain('9.0 / 10')
  expect(wrapper.text()).toContain('2/6')
  wrapper.unmount()
})
