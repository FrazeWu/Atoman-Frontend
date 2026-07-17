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
    await wrapper.get('[data-test="artist-country-input"]').trigger('click')
    await wrapper.get('[data-test="artist-country-option-中国"]').trigger('click')
    await wrapper.get('[data-test="artist-birth-date-input"]').setValue('19770608')
    await wrapper.get('[data-test="artist-form"]').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([[
      {
        name: 'Kanye West',
        bio: 'Artist bio',
        image_url: 'https://example.com/artist.jpg',
        nationality: '中国',
        birth_date: '1977-06-08',
      },
    ]])
  })

  it('formats partial birthday input with segment placeholders', async () => {
    const wrapper = mount(MusicArtistForm, {
      props: {
        submitLabel: '创建艺术家',
      },
    })

    await wrapper.get('[data-test="artist-birth-date-input"]').setValue('1987')

    expect((wrapper.get('[data-test="artist-birth-date-input"]').element as HTMLInputElement).value).toBe('1987/mm/dd')
  })

  it('places country and birthday on the same row', () => {
    const wrapper = mount(MusicArtistForm, {
      props: {
        submitLabel: '创建艺术家',
      },
    })

    const inlineRow = wrapper.get('[data-test="artist-location-row"]')
    expect(inlineRow.find('[data-test="artist-country-input"]').exists()).toBe(true)
    expect(inlineRow.find('[data-test="artist-birth-date-input"]').exists()).toBe(true)
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
