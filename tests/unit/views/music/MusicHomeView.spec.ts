import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ExploreView from '@/views/music/ExploreView.vue'
import HomeView from '@/views/music/HomeView.vue'

describe('Music HomeView.vue', () => {
  it('delegates the album library to ExploreView', () => {
    const wrapper = shallowMount(HomeView)
    const exploreView = wrapper.getComponent(ExploreView)

    expect(exploreView.props('pageTitle')).toBe('专辑')
    expect(exploreView.props('contentMode')).toBe('albums')
  })
})
