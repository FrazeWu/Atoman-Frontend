import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PReferenceMenu from '@/components/shared/PReferenceMenu.vue'
import type { ReferenceSuggestion } from '@/composables/useReferenceAutocomplete'

const suggestions: ReferenceSuggestion[] = [
  { kind: 'type', key: 'type:post', targetType: 'post', label: '文章' },
  { kind: 'target', key: 'user:1', targetType: 'user', id: '1', label: 'Alice', subtitle: '@alice', module: 'blog', path: '/users/alice', available: true },
]

describe('PReferenceMenu', () => {
  it('exposes accessible option state and emits selection', async () => {
    const wrapper = mount(PReferenceMenu, { props: { suggestions, activeIndex: 1 } })
    const options = wrapper.findAll('[role="option"]')
    expect(options).toHaveLength(2)
    expect(options[1].attributes('aria-selected')).toBe('true')
    expect(options[0].text()).toContain('@post:')
    await options[0].trigger('mousedown')
    expect(wrapper.emitted('select')?.[0]).toEqual([suggestions[0]])
  })
})
