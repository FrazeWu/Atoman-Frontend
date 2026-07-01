import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import MediaCollectionWorkspace from '@/components/media/MediaCollectionWorkspace.vue'

const selectedCollectionMock = ref<{ id: string; type: 'article' | 'podcast' | 'video'; name: string } | null>(null)

vi.mock('@/composables/useMediaCollections', () => ({
  useMediaCollections: () => ({
    selectedCollectionId: { value: selectedCollectionMock.value?.id ?? null },
    selectedCollection: selectedCollectionMock,
  }),
}))

describe('MediaCollectionWorkspace', () => {
  beforeEach(() => {
    selectedCollectionMock.value = null
  })

  it('为文章合集提供真实创建入口', () => {
    selectedCollectionMock.value = { id: 'collection-article-1', type: 'article', name: '长文合集' }

    const wrapper = mount(MediaCollectionWorkspace, {
      props: {
        channelId: 'channel-1',
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="typeof to === \'string\' ? to : String(to)"><slot /></a>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('文章工作区')
    expect(wrapper.text()).toContain('写文章')
    const links = wrapper.findAll('a').map(node => node.attributes('href'))
    expect(links).toContain('/posts/post/new?channel=channel-1&collection=collection-article-1')
  })

  it('为视频合集提供真实上传和管理入口', () => {
    selectedCollectionMock.value = { id: 'collection-video-1', type: 'video', name: '视频合集' }

    const wrapper = mount(MediaCollectionWorkspace, {
      props: {
        channelId: 'channel-9',
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="typeof to === \'string\' ? to : String(to)"><slot /></a>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('上传视频')
    expect(wrapper.text()).toContain('管理视频')
    const links = wrapper.findAll('a').map(node => node.attributes('href'))
    expect(links).toContain('/videos/upload?channel=channel-9&collection=collection-video-1')
    expect(links).toContain('/videos/manage?channel=channel-9&collection=collection-video-1')
  })

  it('在拿不到播客 slug 时只保留发布单集入口', () => {
    selectedCollectionMock.value = { id: 'collection-podcast-1', type: 'podcast', name: '访谈播客' }

    const wrapper = mount(MediaCollectionWorkspace, {
      props: {
        channelId: 'channel-3',
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="typeof to === \'string\' ? to : String(to)"><slot /></a>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('播客工作区')
    expect(wrapper.text()).toContain('发布单集')
    const links = wrapper.findAll('a').map(node => node.attributes('href'))
    expect(links).toContain('/podcasts/editor?channel=channel-3&collection=collection-podcast-1')
    expect(wrapper.text()).not.toContain('查看播客')
  })
})
