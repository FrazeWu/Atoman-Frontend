import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import MusicCreationArtistStep from '@/components/music/MusicCreationArtistStep.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

describe('MusicCreationArtistStep.vue', () => {
  beforeEach(() => {
    const drawers = useMusicDrawers()
    drawers.closeAll()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('artist')
  })

  it('blocks moving forward when an additional stage name has no duration', async () => {
    const drawers = useMusicDrawers()
    const wrapper = mount(MusicCreationArtistStep, {
      global: {
        stubs: {
          PCountryRegionField: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<input data-testid="artist-nationality-input" :value="modelValue" />',
          },
        },
      },
    })

    await wrapper.get('[data-testid="artist-legal-name-input"]').setValue('Kanye Omari West')
    await wrapper.get('[data-testid="artist-stage-name-input-0"]').setValue('Kanye West')
    await wrapper.get('[data-testid="artist-add-stage-name-button"]').trigger('click')
    await wrapper.get('[data-testid="artist-stage-name-input-1"]').setValue('Ye')
    await wrapper.get('[data-testid="artist-next-button"]').trigger('click')

    expect(wrapper.get('[data-testid="artist-stage-name-error"]').text()).toContain('请为追加艺名补充持续时间')
    expect(drawers.state.value.creationFlow?.step).toBe('artist')
  })
})
