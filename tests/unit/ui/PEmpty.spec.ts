import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PEmpty from '@/components/ui/PEmpty.vue'

describe('PEmpty.vue', () => {
  it('renders title and description properly', () => {
    const wrapper = mount(PEmpty, {
      props: {
        title: '暂无文章',
        description: '在订阅时间线中查看更新。',
      },
    })
    expect(wrapper.find('.p-empty__title').text()).toBe('暂无文章')
    expect(wrapper.find('.p-empty__description').text()).toBe('在订阅时间线中查看更新。')
    // Default kicker '暂无内容' should not be rendered to prevent noisy duplication
    expect(wrapper.find('.p-empty__kicker').exists()).toBe(false)
  })

  it('renders kicker only when explicitly customized with non-default value', () => {
    const wrapper = mount(PEmpty, {
      props: {
        title: '暂无推荐',
        kicker: '探索',
      },
    })
    expect(wrapper.find('.p-empty__kicker').exists()).toBe(true)
    expect(wrapper.find('.p-empty__kicker').text()).toBe('探索')
  })

  it('supports legacy text and sub aliases', () => {
    const wrapper = mount(PEmpty, {
      props: {
        text: '合集不存在',
        sub: '该合集已被删除或移至其他频道。',
      },
    })
    expect(wrapper.find('.p-empty__title').text()).toBe('合集不存在')
    expect(wrapper.find('.p-empty__description').text()).toBe('该合集已被删除或移至其他频道。')
  })

  it('renders icon and action slots and supports center alignment and compact mode', () => {
    const wrapper = mount(PEmpty, {
      props: {
        title: '暂无数据',
        align: 'center',
        compact: true,
      },
      slots: {
        icon: '<div class="test-icon">icon</div>',
        action: '<button class="test-btn">新建</button>',
      },
    })
    expect(wrapper.classes()).toContain('p-empty--center')
    expect(wrapper.classes()).toContain('p-empty--compact')
    expect(wrapper.find('.test-icon').exists()).toBe(true)
    expect(wrapper.find('.test-btn').exists()).toBe(true)
  })
})
