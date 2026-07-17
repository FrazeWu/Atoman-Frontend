import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ExploreView from '@/views/music/ExploreView.vue'
import HomeView from '@/views/music/HomeView.vue'

describe('Music HomeView query ownership', () => {
  it('leaves album browsing state to ExploreView', () => {
    const wrapper = shallowMount(HomeView)

    expect(wrapper.getComponent(ExploreView).exists()).toBe(true)
    expect(wrapper.find('input').exists()).toBe(false)
  })
})
