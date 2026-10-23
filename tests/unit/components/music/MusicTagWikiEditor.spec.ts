import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MusicTagWikiEditor from '@/components/music/MusicTagWikiEditor.vue'
import MusicTagAssignmentEditor from '@/components/music/MusicTagAssignmentEditor.vue'

const mocks = vi.hoisted(() => ({ history: vi.fn(), edit: vi.fn(), assignments: vi.fn(), tags: vi.fn(), search: vi.fn() }))
vi.mock('@/api/musicV1', () => ({
  getMusicTagHistory: mocks.history, editMusicTagWiki: mocks.edit, editMusicTagAssignments: mocks.assignments,
  listMusicTags: mocks.tags, searchMusicTags: mocks.search, listMusicTagOptions: mocks.search, createMusicTag: vi.fn(),
}))
vi.mock('@/composables/useLoginRedirect', () => ({ useLoginRedirect: () => ({ isAuthenticated: true, requireLogin: () => true }) }))
const global = { stubs: { PModal: { template: '<div><slot /></div>' } } }
async function click(wrapper: ReturnType<typeof mount>, label: string) {
  const button = wrapper.findAll('button').find(row => row.text() === label)
  if (!button) throw new Error(`missing ${label}`)
  await button.trigger('click'); await flushPromises()
}

describe('音乐标签 Wiki 编辑', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.history.mockResolvedValue({ version: 7, revisions: [] })
    mocks.edit.mockResolvedValue({ tags: [], assignments: [], votes: [] })
    mocks.assignments.mockResolvedValue({ version: 8, revisions: [] })
    mocks.search.mockResolvedValue([])
    mocks.tags.mockResolvedValue([])
  })
  it('预览不会保存，明确确认后带基础版本提交', async () => {
    const wrapper = mount(MusicTagWikiEditor, { props: { tag: { id:'folk', name:'Folk', kind:'type', version:7 } }, global })
    await click(wrapper, 'Wiki / 历史')
    const input = wrapper.findAll('input')[0]!
    await input.setValue('Folk rock')
    await click(wrapper, '预览影响')
    expect(mocks.edit).toHaveBeenCalledWith('folk', 'rename', expect.objectContaining({ base_version:7, name:'Folk rock' }), true)
    expect(mocks.edit).toHaveBeenCalledTimes(1)
    await click(wrapper, '确认修改')
    expect(mocks.edit).toHaveBeenLastCalledWith('folk', 'rename', expect.objectContaining({ base_version:7 }))
    expect(wrapper.emitted('changed')).toHaveLength(1)
    wrapper.unmount()
  })
  it('服务端预览冲突时不提供确认操作', async () => {
    mocks.edit.mockRejectedValue(new Error('分类不能形成循环'))
    const wrapper = mount(MusicTagWikiEditor, { props:{tag:{id:'folk',name:'Folk',kind:'type',version:1}}, global })
    await click(wrapper, 'Wiki / 历史'); await click(wrapper, '预览影响')
    expect(wrapper.get('[role=alert]').text()).toContain('循环')
    expect(wrapper.findAll('button').some(row=>row.text()==='确认修改')).toBe(false)
    wrapper.unmount()
  })
  it('十二个标签时先移除再选择，单次原子请求完成替换', async () => {
    const tags = Array.from({length:12}, (_,i)=>({id:`tag-${i}`,assignment_id:`a-${i}`,name:`Mood ${i}`,kind:'mood',upvotes:0,downvotes:0,score:0,viewer_vote:'',can_delete:true}))
    mocks.tags.mockResolvedValue(tags)
    mocks.search.mockResolvedValue([{id:'replacement',name:'Replacement',kind:'mood'}])
    const wrapper = mount(MusicTagAssignmentEditor, {props:{entity:'song',entityId:'song'},global})
    await click(wrapper, '管理 / 替换 / 历史')
    await wrapper.get('[aria-label="移除 Mood 0"]').trigger('click')
    await wrapper.findAll('input')[0]!.setValue('Replacement'); await flushPromises()
    await click(wrapper, '选择'); await click(wrapper, '保存标签修改')
    expect(mocks.assignments).toHaveBeenCalledWith('song','song',expect.objectContaining({base_version:7,add:['replacement'],remove:['tag-0']}))
    expect(mocks.assignments).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
