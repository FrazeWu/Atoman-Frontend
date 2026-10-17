import { describe, expect, it, vi } from 'vitest'
import { postKeys } from '@/entities/post/queries/postKeys'
import { usePostQuery } from '@/entities/post/queries/usePostQuery'
import { createTestQueryClient } from '../../helpers/queryClient'
import { VUE_QUERY_CLIENT } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { defineComponent, toRef } from 'vue'
import * as postApi from '@/entities/post/api/postApi'

describe('postKeys factory', () => {
  it('generates consistent hierarchical query keys', () => {
    expect(postKeys.all).toEqual(['posts'])
    expect(postKeys.lists()).toEqual(['posts', 'list'])
    expect(postKeys.list({ category: 'tech' })).toEqual(['posts', 'list', { category: 'tech' }])
    expect(postKeys.details()).toEqual(['posts', 'detail'])
    expect(postKeys.detail('post-123')).toEqual(['posts', 'detail', 'post-123'])
  })
})

describe('usePostQuery', () => {
  it('fetches post detail through postApi', async () => {
    const mockPost = {
      id: 123,
      slug: 'hello-world',
      title: 'Hello World',
      content: 'Content here',
      visibility: 'public',
      createdAt: '2026-10-17T00:00:00Z',
    }
    vi.spyOn(postApi, 'getPostById').mockResolvedValue(mockPost as any)

    const client = createTestQueryClient()
    const TestComponent = defineComponent({
      props: { postId: { type: String, required: true } },
      setup(props) {
        const query = usePostQuery(toRef(props, 'postId'))
        return { query }
      },
      template: '<div><span v-if="query.data.value">{{ query.data.value.title }}</span></div>',
    })

    const wrapper = mount(TestComponent, {
      props: { postId: '123' },
      global: {
        provide: {
          [VUE_QUERY_CLIENT]: client,
        },
      },
    })

    // 等待异步查询执行
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Hello World')
    })
  })
})
