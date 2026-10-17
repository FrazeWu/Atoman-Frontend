import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, inject } from 'vue'
import { VUE_QUERY_CLIENT, VueQueryPlugin } from '@tanstack/vue-query'
import { createQueryClient } from '@/app/providers/queryClient'
import { createTestQueryClient } from '../helpers/queryClient'

describe('QueryClient configuration and plugin', () => {
  it('creates production QueryClient with 5-minute staleTime and standard defaults', () => {
    const client = createQueryClient()
    const defaultQueryOptions = client.getDefaultOptions().queries
    expect(defaultQueryOptions?.staleTime).toBe(1000 * 60 * 5)
    expect(defaultQueryOptions?.refetchOnWindowFocus).toBe(true)
  })

  it('creates isolated test QueryClient with retry disabled and Infinity gcTime', () => {
    const testClient = createTestQueryClient()
    const queryOpts = testClient.getDefaultOptions().queries
    const mutationOpts = testClient.getDefaultOptions().mutations
    expect(queryOpts?.retry).toBe(false)
    expect(queryOpts?.gcTime).toBe(Infinity)
    expect(mutationOpts?.retry).toBe(false)
  })

  it('injects QueryClient correctly through VueQueryPlugin', () => {
    const client = createTestQueryClient()
    const Consumer = defineComponent({
      template: '<div>{{ hasClient }}</div>',
      setup() {
        const injected = inject(VUE_QUERY_CLIENT)
        return { hasClient: Boolean(injected) }
      },
    })

    const wrapper = mount(Consumer, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: client }]],
      },
    })

    expect(wrapper.text()).toBe('true')
  })
})
