import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PLikeButton from '@/components/ui/PLikeButton.vue'
import PBookmarkButton from '@/components/ui/PBookmarkButton.vue'
import PIcon from '@/components/ui/PIcon.vue'

describe('Content Interaction Buttons', () => {
  describe('PLikeButton.vue', () => {
    it('renders with PIcon and responds to click', async () => {
      const wrapper = mount(PLikeButton, {
        props: {
          liked: false,
          count: 42,
        },
      })

      expect(wrapper.findComponent(PIcon).exists()).toBe(true)
      expect(wrapper.text()).toContain('42')
      expect(wrapper.classes()).not.toContain('is-active')

      await wrapper.trigger('click')
      expect(wrapper.emitted('click')?.[0]).toEqual([true])
      expect(wrapper.emitted('like')).toBeTruthy()
    })

    it('renders active state with .is-active and .is-filled', () => {
      const wrapper = mount(PLikeButton, {
        props: {
          liked: true,
          count: 100,
        },
      })

      expect(wrapper.classes()).toContain('is-active')
      const icon = wrapper.findComponent(PIcon)
      expect(icon.classes()).toContain('is-filled')
    })
  })

  describe('PBookmarkButton.vue', () => {
    it('renders with PIcon and responds to click', async () => {
      const wrapper = mount(PBookmarkButton, {
        props: {
          bookmarked: false,
          count: 10,
        },
      })

      expect(wrapper.findComponent(PIcon).exists()).toBe(true)
      expect(wrapper.text()).toContain('10')
      expect(wrapper.classes()).not.toContain('is-active')

      await wrapper.trigger('click')
      expect(wrapper.emitted('click')?.[0]).toEqual([true])
      expect(wrapper.emitted('bookmark')).toBeTruthy()
    })

    it('renders active state with .is-active and .is-filled', () => {
      const wrapper = mount(PBookmarkButton, {
        props: {
          bookmarked: true,
          count: 11,
        },
      })

      expect(wrapper.classes()).toContain('is-active')
      const icon = wrapper.findComponent(PIcon)
      expect(icon.classes()).toContain('is-filled')
    })
  })
})
