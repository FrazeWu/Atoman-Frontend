import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PImage from '@/components/ui/PImage.vue'

describe('PImage', () => {
  it('renders standard image with default lazy and async decoding', () => {
    const wrapper = mount(PImage, {
      props: {
        src: 'https://example.com/test.jpg',
        alt: 'Test Alt',
        width: 320,
        height: 240,
      },
    })

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/test.jpg')
    expect(img.attributes('alt')).toBe('Test Alt')
    expect(img.attributes('width')).toBe('320')
    expect(img.attributes('height')).toBe('240')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('fetchpriority')).toBe('auto')
    expect(img.attributes('decoding')).toBe('async')
  })

  it('sets eager loading and high fetchpriority when priority is true', () => {
    const wrapper = mount(PImage, {
      props: {
        src: 'https://example.com/hero.jpg',
        priority: true,
      },
    })

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('loading')).toBe('eager')
    expect(img.attributes('fetchpriority')).toBe('high')
  })

  it('allows explicit loading and fetchpriority overrides', () => {
    const wrapper = mount(PImage, {
      props: {
        src: 'https://example.com/override.jpg',
        priority: true,
        loading: 'lazy',
        fetchpriority: 'low',
      },
    })

    const img = wrapper.find('img')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('fetchpriority')).toBe('low')
  })

  it('renders fallback when src is empty', () => {
    const wrapper = mount(PImage, {
      props: {
        src: '',
        fallbackText: '暂无封面',
      },
    })

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.p-image-fallback-text').text()).toBe('暂无封面')
  })

  it('switches to fallback and emits error when image error triggers', async () => {
    const wrapper = mount(PImage, {
      props: {
        src: 'https://example.com/broken.jpg',
        fallbackText: '加载失败',
      },
    })

    expect(wrapper.find('img').exists()).toBe(true)
    await wrapper.find('img').trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.p-image-fallback-text').text()).toBe('加载失败')
    expect(wrapper.emitted('error')).toBeTruthy()
  })

  it('supports custom fallback slot', () => {
    const wrapper = mount(PImage, {
      props: {
        src: null,
      },
      slots: {
        fallback: '<span class="custom-empty">Empty</span>',
      },
    })

    expect(wrapper.find('.custom-empty').text()).toBe('Empty')
  })
})
