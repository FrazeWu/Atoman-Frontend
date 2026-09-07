import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PostEditorSidebar from '@/components/blog/PostEditorSidebar.vue'
import PSelect from '@/components/ui/PSelect.vue'

describe('PostEditorSidebar 合集选择', () => {
  it('将默认合集和普通合集放入同一个单选下拉框', () => {
    const wrapper = mount(PostEditorSidebar, {
      props: {
        mobileOpen: false,
        desktopOpen: true,
        channelCollections: [
          { id: 'default-1', name: '默认合集', is_default: true },
          { id: 'collection-1', name: '专题合集', is_default: false },
        ],
        selectedCollectionId: 'default-1',
        summary: '',
        visibility: 'public',
        tags: [],
        coverUrl: '',
        coverUploading: false,
        coverUploadError: '',
        outlineCount: 0,
        flattenedOutline: [],
        activeHeadingLine: null,
      },
      global: {
        stubs: {
          PostMetaSettingsPanel: true,
          PostCoverField: true,
          PInput: true,
        },
      },
    })

    expect(wrapper.findComponent(PSelect).props('options')).toEqual([
      { label: '默认合集', value: 'default-1' },
      { label: '专题合集', value: 'collection-1' },
    ])
    expect(wrapper.findComponent(PSelect).props('modelValue')).toBe('default-1')
  })
})
