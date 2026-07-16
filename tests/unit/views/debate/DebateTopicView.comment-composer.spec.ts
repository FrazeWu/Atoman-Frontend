import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const argument = {
  id: 'comment-1', debate_id: 'debate-1', user_id: 'user-1', content: '@alice old',
  argument_type: 'support', vote_count: 0, is_concluded: false, created_at: '2026-01-01', updated_at: '2026-01-01',
  mentions: [{ user_id: 'alice-id', start: 0, end: 6 }],
  attachments: [{ id: 'asset-old', url: 'https://cdn.example/old.png', content_type: 'image/png', position: 0 }],
}
const debateStore = {
  currentDebate: {
    id: 'debate-1', user_id: 'user-1', title: 'Topic', description: '', content: '', status: 'open', tags: [],
    argument_count: 1, vote_count: 0, view_count: 0, created_at: '2026-01-01', updated_at: '2026-01-01',
  },
  argumentList: [argument], loading: false, userVotes: {},
  fetchDebate: vi.fn(), fetchArguments: vi.fn(), createArgument: vi.fn(), updateArgument: vi.fn(),
}

vi.mock('@/stores/debate', () => ({ useDebateStore: () => debateStore }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ isAuthenticated: true, user: { id: 'user-1', role: 'user' }, token: 'token' }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }), useRoute: () => ({ params: { id: 'debate-1' } }) }))
vi.mock('@/composables/useMarkdownRenderer', () => ({ useMarkdownRenderer: () => ({ renderMarkdown: (value: string) => value }) }))

import DebateTopicView from '@/views/debate/DebateTopicView.vue'
import CommentComposer from '@/components/comment/CommentComposer.vue'
import ArgumentNode from '@/components/debate/ArgumentNode.vue'

const payload = { content: '😀 @alice', mentions: [{ user_id: 'alice-id', start: 2, end: 8 }], attachment_ids: ['asset-1'] }

function mountView() {
  return mount(DebateTopicView, {
    global: { stubs: {
      PModal: { template: '<div class="modal"><slot /></div>' },
      PButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
      PSelect: true, PEmpty: true, DebateHeaderActions: true, DebateConcludeModal: true,
      CommentComposer: { name: 'CommentComposer', props: ['initialContent', 'initialMentions', 'initialAttachmentIds', 'submitting'], template: '<button class="composer" />' },
      ArgumentNode: { name: 'ArgumentNode', props: ['argument'], template: '<button class="argument" />' },
    } },
  })
}

describe('DebateTopicView comment composer integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    debateStore.createArgument.mockResolvedValue(null)
    debateStore.updateArgument.mockResolvedValue(null)
  })

  it('submits root mention and image data and keeps the draft open on failure', async () => {
	let resolveCreate!: (value: null) => void
	debateStore.createArgument.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve }))
    const wrapper = mountView()
    await wrapper.get('button').trigger('click')
    const composer = wrapper.findComponent(CommentComposer)
    composer.vm.$emit('submit', payload)
	await wrapper.vm.$nextTick()
    expect(debateStore.createArgument).toHaveBeenCalledWith('debate-1', expect.objectContaining(payload))
	expect(composer.props('submitting')).toBe(true)
	composer.vm.$emit('submit', payload)
	expect(debateStore.createArgument).toHaveBeenCalledTimes(1)
	resolveCreate(null)
	await flushPromises()
	expect(composer.props('submitting')).toBe(false)
    expect(wrapper.findComponent(CommentComposer).exists()).toBe(true)
  })

  it('uses the same composer for replies and editing with existing relations', async () => {
    const wrapper = mountView()
    wrapper.findComponent(ArgumentNode).vm.$emit('reply', argument)
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(CommentComposer).exists()).toBe(true)
    expect(wrapper.findComponent(CommentComposer).props('initialContent')).toBeUndefined()
    wrapper.findComponent(CommentComposer).vm.$emit('cancel')

    wrapper.findComponent(ArgumentNode).vm.$emit('edit', argument)
    await wrapper.vm.$nextTick()
    const editor = wrapper.findComponent(CommentComposer)
    expect(editor.props('initialContent')).toBe(argument.content)
    expect(editor.props('initialMentions')).toEqual(argument.mentions)
    expect(editor.props('initialAttachmentIds')).toEqual(['asset-old'])
    editor.vm.$emit('submit', payload)
    await flushPromises()
    expect(debateStore.updateArgument).toHaveBeenCalledWith('comment-1', expect.objectContaining(payload))
    expect(wrapper.findComponent(CommentComposer).exists()).toBe(true)
  })
})
