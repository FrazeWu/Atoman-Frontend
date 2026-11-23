import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
// @ts-expect-error Vitest resolves Vue SFCs through Vite; this test is outside the Vue TS project.
import PReferenceCardList from '@/components/shared/PReferenceCardList.vue'
import type { ResolvedReference } from '@/api/references'
import type { ContentReference } from '@/types'

describe('PReferenceCardList', () => {
  it('渲染富元数据引用卡片、排除用户提及并去重', () => {
    const refs: ResolvedReference[] = [
      {
        kind: 'user',
        target_type: 'user',
        target_id: 'u-1',
        start: 0,
        end: 6,
        label: 'Alice',
        subtitle: '@alice',
        module: 'blog',
        path: '/users/alice',
        available: true,
      },
      {
        kind: 'resource',
        target_type: 'article',
        target_id: 'art-1',
        start: 7,
        end: 52,
        label: '深入理解检索排序',
        excerpt: '本文介绍了检索排序的离线指标与线上实验设计。',
        source_name: '工程周刊',
        published_at: '2026-11-20T08:30:00Z',
        module: 'feed',
        path: '/item/art-1',
        available: true,
      },
      {
        kind: 'resource',
        target_type: 'article',
        target_id: 'art-1',
        start: 53,
        end: 98,
        label: '深入理解检索排序',
        module: 'feed',
        path: '/item/art-1',
        available: true,
      },
    ]

    const wrapper = mount(PReferenceCardList, {
      props: { references: refs },
    })

    const cards = wrapper.findAll('[data-test="reference-card"]')
    expect(cards).toHaveLength(1)
    expect(cards[0].text()).toContain('资讯')
    expect(cards[0].text()).toContain('深入理解检索排序')
    expect(cards[0].text()).toContain('本文介绍了检索排序的离线指标与线上实验设计。')
    expect(cards[0].text()).toContain('工程周刊')
    expect(cards[0].text()).toContain('2026/11/20')
    expect(wrapper.text()).not.toContain('@alice')
  })

  it('在 available 为 false 时显示不可访问占位卡片', () => {
    const refs: ResolvedReference[] = [
      {
        kind: 'resource',
        target_type: 'post',
        target_id: 'post-missing',
        start: 0,
        end: 42,
        label: '已删除文章',
        module: 'blog',
        path: '/post/post-missing',
        available: false,
      },
    ]

    const wrapper = mount(PReferenceCardList, {
      props: { references: refs },
    })

    expect(wrapper.find('[data-test="reference-card"]').exists()).toBe(false)
    const unavailable = wrapper.get('[data-test="reference-card-unavailable"]')
    expect(unavailable.text()).toContain('文章')
    expect(unavailable.text()).toContain('该引用来源已删除或不可访问')
  })

  it('兼容 ContentReference 与辩论关系徽章及 stale 状态', () => {
    const refs: ContentReference[] = [
      {
        id: 'ref-1',
        field: 'content',
        start: 0,
        end: 40,
        raw: '@debate:d-1:support',
        target: {
          type: 'debate',
          id: 'd-1',
          label: '是否应当全面推行可复现构建',
          excerpt: '核心论证综述',
          source_name: 'Alice Chen',
          published_at: '2026-11-18T12:00:00Z',
          module: 'debate',
          path: '/d-1',
          available: false,
        },
        relation: {
          id: 'rel-1',
          stance: 'support',
          state: 'stale',
        },
      },
    ]

    const wrapper = mount(PReferenceCardList, {
      props: { references: refs },
    })

    const item = wrapper.get('[data-test="reference-card-unavailable"]')
    expect(item.text()).toContain('辩题')
    expect(item.text()).toContain('支撑')
    expect(item.text()).toContain('来源结论已变化')
    expect(item.text()).toContain('是否应当全面推行可复现构建')
  })

  it('点击可用卡片时阻止事件冒泡并通过 router.push 导航', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/feed/item/art-9', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    await router.isReady()
    const pushSpy = vi.spyOn(router, 'push')
    const parentClick = vi.fn()

    const Host = {
      components: { PReferenceCardList },
      props: ['refsList'],
      methods: { parentClick },
      template: '<div @click="parentClick"><PReferenceCardList :references="refsList" /></div>',
    }

    const wrapper = mount(Host, {
      props: {
        refsList: [{
          kind: 'resource',
          target_type: 'article',
          target_id: 'art-9',
          start: 0,
          end: 45,
          label: '可点击文章',
          module: 'feed',
          path: '/item/art-9',
          available: true,
        }] satisfies ResolvedReference[],
      },
      global: { plugins: [router] },
    })

    await wrapper.get('[data-test="reference-card"]').trigger('click')
    expect(parentClick).not.toHaveBeenCalled()
    expect(pushSpy).toHaveBeenCalledWith('/feed/item/art-9')
  })
})
