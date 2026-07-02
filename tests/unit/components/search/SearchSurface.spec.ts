import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SearchSurface from '@/components/search/SearchSurface.vue'

describe('SearchSurface.vue', () => {
  it('renders header, input, actions and dropdown states', async () => {
    const wrapper = mount(SearchSurface, {
      props: {
        query: 'ye',
        open: true,
        eyebrow: 'Artist Search',
        status: '结果 1',
        placeholder: '搜索艺术家...',
        inputTestId: 'search-input',
        loading: false,
      },
      slots: {
        results: '<button data-testid="result-item">Ye</button>',
        actions: '<button data-testid="action-item">添加</button>',
      },
    })

    expect(wrapper.text()).toContain('Artist Search')
    expect(wrapper.text()).toContain('结果 1')
    expect(wrapper.find('[data-testid="search-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="result-item"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="action-item"]').exists()).toBe(true)
  })

  it('shows hint and loading states in dropdown', async () => {
    const wrapper = mount(SearchSurface, {
      props: {
        query: '',
        open: true,
        eyebrow: 'Explore Search',
        status: '搜索专辑或艺术家',
        placeholder: '搜索...',
        hint: '输入名称开始搜索',
        loading: true,
      },
    })

    expect(wrapper.text()).toContain('搜索中...')
    await wrapper.setProps({ loading: false })
    expect(wrapper.text()).toContain('输入名称开始搜索')
  })

  it('does not render empty dropdown shell by default', async () => {
    const wrapper = mount(SearchSurface, {
      props: {
        query: '',
        open: true,
        eyebrow: 'Artist Search',
        status: '浏览全部',
        placeholder: '搜索艺术家...',
      },
    })

    expect(wrapper.find('[data-testid="search-surface-dropdown"]').exists()).toBe(false)
  })

  it('uses compact state before opening', async () => {
    const wrapper = mount(SearchSurface, {
      props: {
        query: '',
        open: false,
        compact: true,
        eyebrow: 'Artist Search',
        status: '浏览全部',
      },
    })

    expect(wrapper.find('.search-frame').classes()).toContain('is-compact')
    await wrapper.setProps({ open: true, hint: '输入名称开始搜索' })
    expect(wrapper.find('.search-frame').classes()).not.toContain('is-compact')
  })
})
