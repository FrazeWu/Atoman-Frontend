import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import BookCard from '@/components/books/BookCard.vue'
import type { BookPublicWork } from '@/api/books'

describe('BookCard.vue', () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/books', component: { template: '<div>books</div>' } },
      { path: '/books/work/:id', component: { template: '<div>work</div>' } },
    ],
  })

  const mockWork: BookPublicWork = {
    id: 'work-100',
    title: '理想国',
    subtitle: '古希腊哲学的奠基之作',
    lifecycle_status: 'published',
    rating_score: 4.9,
    rating_count: 1420,
    authors: [{ id: 'author-1', name: '柏拉图', role: 'author' }],
    editions: [],
  }

  it('渲染作品排版封面，严格单行展示书名与精简评分', async () => {
    await router.push('/books')
    await router.isReady()

    const wrapper = mount(BookCard, {
      props: { work: mockWork },
      global: { plugins: [router] },
    })

    // 抽象作品封面使用 work variant
    expect(wrapper.text()).toContain('理想国')
    expect(wrapper.text()).toContain('古希腊哲学的奠基之作')
    expect(wrapper.text()).toContain('柏拉图')

    // 单行 meta 展示书名与单行精炼评分
    const metaLine = wrapper.find('.book-card__meta-line')
    expect(metaLine.exists()).toBe(true)
    expect(metaLine.find('.book-card__title').text()).toBe('理想国')
    expect(metaLine.find('.book-card__rating').text()).toContain('4.9')

    // 链接正确指向作品详情
    const link = wrapper.find('a.book-card')
    expect(link.attributes('href')).toBe('/books/work/work-100')
  })

  it('无评分时不展示评分徽标', async () => {
    const unratedWork: BookPublicWork = {
      ...mockWork,
      id: 'work-101',
      title: '未评分作品',
      rating_score: 0,
      rating_count: 0,
    }

    const wrapper = mount(BookCard, {
      props: { work: unratedWork },
      global: { plugins: [router] },
    })

    expect(wrapper.find('.book-card__rating').exists()).toBe(false)
    expect(wrapper.find('.book-card__title').text()).toBe('未评分作品')
  })
})
