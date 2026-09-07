import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MusicTagList from '@/components/music/MusicTagList.vue'

const mocks = vi.hoisted(() => ({
  listMusicTags: vi.fn(),
  addMusicTag: vi.fn(),
  deleteMusicTag: vi.fn(),
  voteMusicTag: vi.fn(),
  requireLogin: vi.fn(),
  isAuthenticated: { value: true },
}))

vi.mock('@/api/musicV1', () => ({
  listMusicTags: mocks.listMusicTags,
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
    mocks.listMusicTags.mockReset()
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

    await wrapper.get('[data-testid="music-tag-name-input"]').setValue('夜晚')
    await wrapper.get('form').trigger('submit')
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
})
