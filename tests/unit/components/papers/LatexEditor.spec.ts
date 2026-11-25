import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LatexEditor from '@/components/papers/LatexEditor.vue'
import * as Y from 'yjs'
import {markRaw,nextTick} from 'vue'
import {encodeSelection} from '@/components/papers/paperPresence'

describe('Papers LaTeX editor', () => {
  it('updates actual editability while a file transition is in progress',async()=>{
    const wrapper=mount(LatexEditor,{props:{modelValue:'Draft',readonly:false}})
    try{
      expect(wrapper.find('.cm-content').attributes('contenteditable')).toBe('true')
      await wrapper.setProps({readonly:true})
      expect(wrapper.find('.cm-content').attributes('contenteditable')).toBe('false')
      await wrapper.setProps({readonly:false})
      expect(wrapper.find('.cm-content').attributes('contenteditable')).toBe('true')
    }finally{wrapper.unmount()}
  })
  it('does not treat parent-provided content as a new user edit', async () => {
    const wrapper = mount(LatexEditor, { props: { modelValue: 'Initial draft' } })
    try {
      expect(wrapper.find('.cm-content').text()).toContain('Initial draft')
      await wrapper.setProps({ modelValue: 'Loaded chapter' })
      expect(wrapper.find('.cm-content').text()).toContain('Loaded chapter')
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    } finally {
      wrapper.unmount()
    }
  })

  it('inserts a block at the selection end without deleting selected source',async()=>{
    const wrapper=mount(LatexEditor,{props:{modelValue:'before after',readonly:false}})
    try{
      const editor=wrapper.vm as unknown as {goToMatch:(line:number,col:number,len:number)=>void;insertBlock:(text:string)=>boolean}
      editor.goToMatch(1,1,6)
      expect(editor.insertBlock('FIGURE')).toBe(true)
      expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe('before\nFIGURE\n after')
      await wrapper.setProps({readonly:true})
      expect(editor.insertBlock('NO')).toBe(false)
    }finally{wrapper.unmount()}
  })
})

describe('Papers authoritative Y.Text binding',()=>{
 it('uses Y.Text instead of stale modelValue and never emits ordinary saves',async()=>{
  const doc=new Y.Doc(),text=markRaw(doc.getText('source'))
  text.insert(0,'server text')
  const wrapper=mount(LatexEditor,{props:{modelValue:'stale draft',collaborativeText:text,readonly:false}})
  try{
   expect(wrapper.find('.cm-content').text()).toBe('server text')
   await wrapper.setProps({modelValue:'must not overwrite'})
   expect(text.toString()).toBe('server text')
   text.insert(0,'remote ')
   expect(wrapper.find('.cm-content').text()).toBe('remote server text')
   const editor=wrapper.vm as unknown as {goToMatch:(line:number,col:number,len:number)=>void;insertBlock:(value:string)=>boolean}
   editor.goToMatch(1,1,0)
   expect(editor.insertBlock('local')).toBe(true)
   expect(text.toString()).toBe('local\nremote server text')
   expect(wrapper.emitted('update:modelValue')).toBeUndefined()
   await wrapper.setProps({readonly:true})
   expect(wrapper.find('.cm-content').attributes('contenteditable')).toBe('false')
   expect(editor.insertBlock('no')).toBe(false)
  }finally{wrapper.unmount();doc.destroy()}
 })
})

describe('Papers remote cursor rendering',()=>{
 it('renders a scoped remote cursor and removes it when its member leaves',async()=>{
  const doc=new Y.Doc(),text=markRaw(doc.getText('source'))
  text.insert(0,'server text')
  const peer={connection_id:'550e8400-e29b-41d4-a716-446655440001',user_id:'550e8400-e29b-41d4-a716-446655440002',name:'Peer',role:'editor' as const,selection:encodeSelection(text,{anchor:1,head:4})!}
  const wrapper=mount(LatexEditor,{props:{modelValue:text.toString(),collaborativeText:text,readonly:false,remotePeers:[peer]}})
  try{
   expect(wrapper.find('.papers-remote-cursor-label').text()).toBe('Peer')
   expect(wrapper.find('.papers-remote-selection').exists()).toBe(true)
   text.insert(0,'new ')
   await wrapper.setProps({modelValue:text.toString()})
   await nextTick()
   expect(wrapper.find('.papers-remote-cursor-label').text()).toBe('Peer')
   await wrapper.setProps({remotePeers:[]})
   expect(wrapper.find('.papers-remote-cursor-label').exists()).toBe(false)
  }finally{wrapper.unmount();doc.destroy()}
 })
})
