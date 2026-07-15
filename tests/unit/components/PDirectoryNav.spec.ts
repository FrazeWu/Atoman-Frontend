import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import PDirectoryNav from '@/components/ui/PDirectoryNav.vue'

const directorySource = readFileSync(resolve(__dirname, '../../../src/components/ui/PDirectoryNav.vue'), 'utf8')
const items = [
  { id: 'intro', label: '简介' },
  { id: 'method', label: '采集方法', depth: 1, branch: true },
  { id: 'source', label: '资料来源', depth: 2 },
]

const PSheetStub = defineComponent({
  props: { show: Boolean, title: String },
  emits: ['close'],
  template: `
    <section v-if="show" class="p-directory-sheet-stub">
      <button class="sheet-close" @click="$emit('close')">关闭</button>
      <slot />
    </section>
  `,
})

const mountDirectory = (props: Record<string, unknown> = {}) => mount(PDirectoryNav, {
  props: { items, activeId: 'method', ...props },
  global: { stubs: { PSheet: PSheetStub } },
})

describe('PDirectoryNav', () => {
  it('renders one floating directory without item counts', () => {
    const wrapper = mountDirectory()
    expect(wrapper.get('.p-directory-panel').text()).toContain('目录')
    expect(wrapper.findAll('.p-directory-panel .p-directory-item')).toHaveLength(3)
    expect(wrapper.text()).not.toMatch(/\d+\s*(项|个标题)/)
  })

  it('renders active, branch and nested item states', () => {
    const nodes = mountDirectory().findAll('.p-directory-panel .p-directory-item')
    expect(nodes[1].classes()).toContain('is-active')
    expect(nodes[1].classes()).toContain('is-branch')
    expect(nodes[2].attributes('style')).toContain('--p-directory-depth: 2')
  })

  it('emits selection and supports collapsing to the side', async () => {
    const wrapper = mountDirectory()
    await wrapper.findAll('.p-directory-panel .p-directory-item')[2].trigger('click')
    expect(wrapper.emitted('select')).toEqual([['source']])

    await wrapper.get('.p-directory-toggle').trigger('click')
    expect(wrapper.emitted('update:collapsed')).toEqual([[true]])
    await wrapper.setProps({ collapsed: true })
    expect(wrapper.get('.p-directory-panel').classes()).toContain('is-collapsed')
    expect(wrapper.get('.p-directory-toggle').attributes('aria-label')).toBe('展开目录')
  })

  it('reuses the directory items in a mobile bottom sheet', async () => {
    const wrapper = mountDirectory({ mobileOpen: true })
    expect(wrapper.findAll('.p-directory-sheet-stub .p-directory-item')).toHaveLength(3)
    await wrapper.findAll('.p-directory-sheet-stub .p-directory-item')[1].trigger('click')
    expect(wrapper.emitted('select')).toEqual([['method']])
    expect(wrapper.emitted('close-mobile')).toHaveLength(1)
  })

  it('sticks the outer shell so the panel follows page scroll', () => {
    expect(directorySource).toMatch(/\.p-directory-shell\s*\{[^}]*position:\s*sticky/s)
    expect(directorySource).toMatch(/\.p-directory-panel\s*\{[^}]*position:\s*relative/s)
  })
})
