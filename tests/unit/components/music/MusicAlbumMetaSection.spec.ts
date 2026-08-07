import { mount } from '@vue/test-utils'

import MusicAlbumMetaSection from '@/components/music/MusicAlbumMetaSection.vue'

describe('MusicAlbumMetaSection', () => {
  it('shows the album description and emits edits', async () => {
    const wrapper = mount(MusicAlbumMetaSection, {
      props: {
        contributors: [],
        album: '测试专辑',
        releaseDate: '',
        albumType: 'album',
        description: '原简介',
      },
    })

    const textarea = wrapper.get('textarea[placeholder="输入专辑简介"]')
    expect(textarea.element.value).toBe('原简介')

    await textarea.setValue('新简介')
    expect(wrapper.emitted('update:description')?.at(-1)).toEqual(['新简介'])
  })
})
