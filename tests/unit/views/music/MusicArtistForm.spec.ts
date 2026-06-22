import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import MusicArtistForm from '@/components/music/MusicArtistForm.vue'

describe('MusicArtistForm.vue', () => {
  it('renders artist fields and emits normalized submit payload', async () => {
    const wrapper = mount(MusicArtistForm, {
      props: {
        submitLabel: '创建艺术家',
      },
    })

    await wrapper.get('[data-test="artist-name-input"]').setValue('  Kanye West  ')
    await wrapper.get('[data-test="artist-bio-input"]').setValue(' Artist bio ')
    await wrapper.get('[data-test="artist-image-input"]').setValue(' https://example.com/artist.jpg ')
    await wrapper.get('[data-test="artist-country-input"]').setValue(' US ')
    await wrapper.get('[data-test="artist-birth-date-input"]').setValue('1977-06-08')
    await wrapper.get('[data-test="artist-form"]').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([[
      {
        name: 'Kanye West',
        bio: 'Artist bio',
        image_url: 'https://example.com/artist.jpg',
        nationality: 'US',
        birth_date: '1977-06-08',
      },
    ]])
  })

  it('shows a required error when name is missing', async () => {
    const wrapper = mount(MusicArtistForm, {
      props: {
        submitLabel: '创建艺术家',
      },
    })

    await wrapper.get('[data-test="artist-form"]').trigger('submit')

    expect(wrapper.text()).toContain('请输入艺术家名称')
    expect(wrapper.emitted('submit')).toBeFalsy()
  })
})
