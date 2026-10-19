import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MButton from '@mobile/components/ui/MButton.vue'
import MSheet from '@mobile/components/ui/MSheet.vue'
import MInput from '@mobile/components/ui/MInput.vue'
import MAvatar from '@mobile/components/ui/MAvatar.vue'

describe('Mobile UI Primitives', () => {
  describe('MIcon.vue', () => {
    it('renders SVG with default size and stroke width', () => {
      const wrapper = mount(MIcon, {
        props: {
          name: 'music',
        },
      })
      const svg = wrapper.find('svg')
      expect(svg.exists()).toBe(true)
      expect(svg.classes()).toContain('m-icon')
      expect(svg.classes()).toContain('m-icon--md')
      expect(svg.attributes('stroke-width')).toBe('1.6')
      expect(svg.attributes('viewBox')).toBe('0 0 24 24')
      expect(svg.attributes('fill')).toBe('none')
      expect(svg.attributes('stroke')).toBe('currentColor')
    })

    it('accepts custom size and strokeWidth', () => {
      const wrapper = mount(MIcon, {
        props: {
          name: 'feed',
          size: 'lg',
          strokeWidth: 2.1,
        },
      })
      const svg = wrapper.find('svg')
      expect(svg.classes()).toContain('m-icon--lg')
      expect(svg.attributes('stroke-width')).toBe('2.1')
    })

    it('supports all required icon names', () => {
      const requiredIcons = [
        'feed', 'music', 'books', 'blog', 'debate', 'messages', 'studio',
        'chevron-down', 'xmark', 'search', 'bell', 'compass', 'person',
        'library', 'playlists', 'antenna', 'bookmark', 'heart', 'shelf', 'notes',
        'player-prev', 'player-next', 'player-play', 'player-pause', 'waveform',
        'battery', 'cellular',
      ]

      for (const name of requiredIcons) {
        const wrapper = mount(MIcon, { props: { name } })
        expect(wrapper.find('svg').exists()).toBe(true)
        // SVG should have inner geometric path/line elements, not be empty
        expect(wrapper.html()).not.toBe('<svg class="m-icon m-icon--md" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></svg>')
      }
    })

    it('handles unknown icon gracefully without throwing', () => {
      const wrapper = mount(MIcon, {
        props: {
          name: 'non-existent-icon',
        },
      })
      expect(wrapper.find('svg').exists()).toBe(true)
    })
  })

  describe('MButton.vue', () => {
    it('renders slot content and defaults to primary variant and md size', () => {
      const wrapper = mount(MButton, {
        slots: {
          default: '确认操作',
        },
      })
      expect(wrapper.text()).toBe('确认操作')
      expect(wrapper.classes()).toContain('m-button')
      expect(wrapper.classes()).toContain('m-button--primary')
      expect(wrapper.classes()).toContain('m-button--md')
    })

    it('supports secondary, ghost, and danger variants', async () => {
      const variants = ['secondary', 'ghost', 'danger'] as const
      for (const variant of variants) {
        const wrapper = mount(MButton, {
          props: { variant },
        })
        expect(wrapper.classes()).toContain(`m-button--${variant}`)
      }
    })

    it('supports block prop', () => {
      const wrapper = mount(MButton, {
        props: { block: true },
      })
      expect(wrapper.classes()).toContain('m-button--block')
    })

    it('emits click event on user click', async () => {
      const wrapper = mount(MButton)
      await wrapper.trigger('click')
      expect(wrapper.emitted('click')).toHaveLength(1)
    })

    it('does not emit click when disabled or loading', async () => {
      const disabledWrapper = mount(MButton, {
        props: { disabled: true },
      })
      await disabledWrapper.trigger('click')
      expect(disabledWrapper.emitted('click')).toBeUndefined()
      expect(disabledWrapper.classes()).toContain('is-disabled')

      const loadingWrapper = mount(MButton, {
        props: { loading: true },
      })
      await loadingWrapper.trigger('click')
      expect(loadingWrapper.emitted('click')).toBeUndefined()
      expect(loadingWrapper.classes()).toContain('is-loading')
    })
  })

  describe('MSheet.vue', () => {
    it('renders nothing when modelValue is false', () => {
      const wrapper = mount(MSheet, {
        props: {
          modelValue: false,
        },
      })
      expect(wrapper.find('.m-sheet').exists()).toBe(false)
    })

    it('renders backdrop, sheet panel, handle, title, and slot when modelValue is true', () => {
      const wrapper = mount(MSheet, {
        props: {
          modelValue: true,
          title: '选择选项',
        },
        slots: {
          default: '<div class="sheet-content">抽屉内容</div>',
        },
      })
      expect(wrapper.find('.m-sheet').exists()).toBe(true)
      expect(wrapper.find('.m-sheet__backdrop').exists()).toBe(true)
      expect(wrapper.find('.m-sheet__handle').exists()).toBe(true)
      expect(wrapper.find('.m-sheet__title').text()).toBe('选择选项')
      expect(wrapper.find('.sheet-content').text()).toBe('抽屉内容')
    })

    it('emits update:modelValue and close when backdrop is clicked', async () => {
      const wrapper = mount(MSheet, {
        props: {
          modelValue: true,
        },
      })
      await wrapper.find('.m-sheet__backdrop').trigger('click')
      expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('emits update:modelValue and close when close button is clicked', async () => {
      const wrapper = mount(MSheet, {
        props: {
          modelValue: true,
          title: '抽屉标题',
        },
      })
      const closeBtn = wrapper.find('.m-sheet__close')
      expect(closeBtn.exists()).toBe(true)
      await closeBtn.trigger('click')
      expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
      expect(wrapper.emitted('close')).toHaveLength(1)
    })
  })

  describe('MInput.vue', () => {
    it('renders input with modelValue and placeholder', () => {
      const wrapper = mount(MInput, {
        props: {
          modelValue: '初始文字',
          placeholder: '请输入搜索内容',
        },
      })
      const input = wrapper.find('input')
      expect(input.exists()).toBe(true)
      expect(input.element.value).toBe('初始文字')
      expect(input.attributes('placeholder')).toBe('请输入搜索内容')
    })

    it('emits update:modelValue when input changes', async () => {
      const wrapper = mount(MInput, {
        props: {
          modelValue: '',
        },
      })
      const input = wrapper.find('input')
      await input.setValue('新输入的内容')
      expect(wrapper.emitted('update:modelValue')).toEqual([['新输入的内容']])
    })

    it('shows clear button only when clearable is true and value is not empty', async () => {
      const wrapper = mount(MInput, {
        props: {
          modelValue: '',
          clearable: true,
        },
      })
      expect(wrapper.find('.m-input__clear').exists()).toBe(false)

      await wrapper.setProps({ modelValue: '有文字' })
      expect(wrapper.find('.m-input__clear').exists()).toBe(true)

      await wrapper.find('.m-input__clear').trigger('click')
      expect(wrapper.emitted('update:modelValue')).toEqual([['']])
    })
  })

  describe('MAvatar.vue', () => {
    it('renders img when src is provided', () => {
      const wrapper = mount(MAvatar, {
        props: {
          src: '/avatar.jpg',
          name: 'Alice',
          size: 40,
        },
      })
      const img = wrapper.find('img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe('/avatar.jpg')
      expect(wrapper.find('.m-avatar__monogram').exists()).toBe(false)
    })

    it('renders monogram fallback when only name is provided', () => {
      const wrapper = mount(MAvatar, {
        props: {
          name: 'Bob Marley',
          size: 32,
        },
      })
      expect(wrapper.find('img').exists()).toBe(false)
      const monogram = wrapper.find('.m-avatar__monogram')
      expect(monogram.exists()).toBe(true)
      expect(monogram.text()).toBe('B')
    })

    it('renders ? fallback when neither src nor name is provided', () => {
      const wrapper = mount(MAvatar)
      expect(wrapper.find('img').exists()).toBe(false)
      const monogram = wrapper.find('.m-avatar__monogram')
      expect(monogram.exists()).toBe(true)
      expect(monogram.text()).toBe('?')
    })

    it('falls back to monogram when image triggers error', async () => {
      const wrapper = mount(MAvatar, {
        props: {
          src: '/broken.jpg',
          name: 'Charlie',
        },
      })
      const img = wrapper.find('img')
      expect(img.exists()).toBe(true)

      await img.trigger('error')
      expect(wrapper.find('img').exists()).toBe(false)
      const monogram = wrapper.find('.m-avatar__monogram')
      expect(monogram.exists()).toBe(true)
      expect(monogram.text()).toBe('C')
    })
  })
})
