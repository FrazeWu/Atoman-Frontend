import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import MusicTagList from '@/components/music/MusicTagList.vue'

const mocks = vi.hoisted(() => ({
  listMusicTags: vi.fn(),
  searchMusicTags: vi.fn(),
  addMusicTag: vi.fn(),
  deleteMusicTag: vi.fn(),
  voteMusicTag: vi.fn(),
  requireLogin: vi.fn(),
  isAuthenticated: { value: true },
}))

vi.mock('@/api/musicV1', () => ({
  listMusicTags: mocks.listMusicTags,
  searchMusicTags: mocks.searchMusicTags,
  addMusicTag: mocks.addMusicTag,
  deleteMusicTag: mocks.deleteMusicTag,
  voteMusicTag: mocks.voteMusicTag,
}))

vi.mock('@/composables/useLoginRedirect', () => ({
  useLoginRedirect: () => ({
    requireLogin: mocks.requireLogin,
    isAuthenticated: mocks.isAuthenticated,
  }),
}))

describe('MusicTagList.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.listMusicTags.mockReset()
    mocks.searchMusicTags.mockReset()
    mocks.addMusicTag.mockReset()
    mocks.deleteMusicTag.mockReset()
    mocks.voteMusicTag.mockReset()
    mocks.requireLogin.mockReset()
    mocks.requireLogin.mockReturnValue(true)
    mocks.isAuthenticated.value = true
    mocks.listMusicTags.mockResolvedValue([
      {
        id: 'tag-mood',
        assignment_id: 'assignment-mood',
        name: '治愈',
        kind: 'mood',
        upvotes: 2,
        downvotes: 1,
        score: 1,
        viewer_vote: '',
        can_delete: true,
      },
      {
        id: 'tag-type',
        assignment_id: 'assignment-type',
        name: '现场',
        kind: 'type',
        upvotes: 4,
        downvotes: 0,
        score: 4,
        viewer_vote: 'up',
        can_delete: false,
      },
    ])
    mocks.searchMusicTags.mockResolvedValue([])
    mocks.addMusicTag.mockResolvedValue({
      id: 'tag-new',
      assignment_id: 'assignment-new',
      name: '夜晚',
      kind: 'mood',
      upvotes: 0,
      downvotes: 0,
      score: 0,
      viewer_vote: '',
      can_delete: true,
    })
    mocks.voteMusicTag.mockResolvedValue({
      id: 'tag-mood',
      assignment_id: 'assignment-mood',
      name: '治愈',
      kind: 'mood',
      upvotes: 3,
      downvotes: 1,
      score: 2,
      viewer_vote: 'up',
      can_delete: true,
    })
    mocks.deleteMusicTag.mockResolvedValue({ deleted: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('按情绪和类型分组展示标签，并支持添加、投票和确认删除', async () => {
    const wrapper = mount(MusicTagList, {
      props: { entity: 'song', entityId: 'song-1' },
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          PInteractionActions: {
            props: ['liked', 'disliked', 'likeCount', 'dislikeCount', 'disabled'],
            template: `
              <div>
                <button data-testid="vote-up" :disabled="disabled" @click="$emit('like-change', !liked)">赞</button>
                <button data-testid="vote-down" :disabled="disabled" @click="$emit('dislike-change', !disliked)">踩</button>
              </div>
            `,
          },
          PConfirm: {
            name: 'PConfirm',
            props: ['show'],
            template: '<div v-if="show" data-testid="tag-delete-confirm"><button data-testid="confirm-delete" @click="$emit(\'confirm\')">确认</button></div>',
          },
        },
      },
    })
    await flushPromises()

    expect(wrapper.get('[data-testid="music-tag-group-mood"]').text()).toContain('治愈')
    expect(wrapper.get('[data-testid="music-tag-group-type"]').text()).toContain('现场')

    await wrapper.get('[data-testid="music-tag-search-mood"]').setValue('夜晚')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    await wrapper.get('[data-testid="music-tag-create-mood"]').trigger('click')
    await flushPromises()
    expect(mocks.addMusicTag).toHaveBeenCalledWith('song', 'song-1', { kind: 'mood', name: '夜晚' })
    expect(wrapper.get('[data-testid="music-tag-group-mood"]').text()).toContain('夜晚')

    await wrapper.get('[data-testid="vote-up"]').trigger('click')
    await flushPromises()
    expect(mocks.voteMusicTag).toHaveBeenCalledWith('song', 'song-1', 'tag-mood', 'up')

    await wrapper.get('[data-testid="music-tag-delete-tag-mood"]').trigger('click')
    expect(wrapper.get('[data-testid="tag-delete-confirm"]').exists()).toBe(true)
    await wrapper.get('[data-testid="confirm-delete"]').trigger('click')
    await flushPromises()
    expect(mocks.deleteMusicTag).toHaveBeenCalledWith('song', 'song-1', 'tag-mood')
    expect(wrapper.find('[data-testid="music-tag-delete-tag-mood"]').exists()).toBe(false)
  })

  it('将标签名称链接到独立标签页，并按当前资源类型设置默认视图', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(MusicTagList, {
      props: { entity: 'album', entityId: 'album-1' },
      global: {
        plugins: [router],
        stubs: {
          RouterLink: {
            props: ['to'],
            computed: {
              href() { return this.$router.resolve(this.to).href },
            },
            template: '<a :href="href"><slot /></a>',
          },
          PInteractionActions: true,
          PConfirm: true,
        },
      },
    })
    await flushPromises()

    const link = wrapper.get('[data-testid="music-tag-tag-mood"] .music-tag__name')
    expect(link.attributes('href')).toContain('/music/tags/tag-mood')
    expect(link.attributes('href')).toContain('view=albums')
    expect(link.attributes('href')).not.toContain('tag_entity=album')
  })

  it('分别搜索情绪和类型标签，已有结果可选择，无结果才显示创建入口', async () => {
    mocks.searchMusicTags.mockImplementation(async (kind: string) => kind === 'mood'
      ? [{ id: 'tag-existing', name: '温柔', kind: 'mood' }]
      : [])
    const wrapper = mount(MusicTagList, {
      props: { entity: 'song', entityId: 'song-1' },
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          PInteractionActions: true,
          PConfirm: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="music-tag-kind-selector"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="music-tag-search-mood"]')).toBeTruthy()
    expect(wrapper.get('[data-testid="music-tag-search-type"]')).toBeTruthy()

    await wrapper.get('[data-testid="music-tag-search-mood"]').setValue('温柔')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    expect(mocks.searchMusicTags).toHaveBeenCalledWith('mood', '温柔')
    expect(wrapper.get('[data-testid="music-tag-option-tag-existing"]').text()).toContain('温柔')
    expect(wrapper.find('[data-testid="music-tag-create-mood"]').exists()).toBe(false)

    await wrapper.get('[data-testid="music-tag-option-tag-existing"]').trigger('click')
    await flushPromises()
    expect(mocks.addMusicTag).toHaveBeenCalledWith('song', 'song-1', { kind: 'mood', name: '温柔' })

    await wrapper.get('[data-testid="music-tag-search-type"]').setValue('概念专辑')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    expect(mocks.searchMusicTags).toHaveBeenCalledWith('type', '概念专辑')
    expect(wrapper.get('[data-testid="music-tag-create-type"]').text()).toContain('创建“概念专辑”')
  })
})
