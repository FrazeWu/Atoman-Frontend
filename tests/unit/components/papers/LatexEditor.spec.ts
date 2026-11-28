import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
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

describe('Local-only collaborative undo',()=>{
 it('undoes and redoes only this editor changes while preserving remote insertions and deletions',async()=>{
  const doc=new Y.Doc(),peer=new Y.Doc(),text=markRaw(doc.getText('source'))
  text.insert(0,'server text')
  const wrapper=mount(LatexEditor,{props:{modelValue:text.toString(),collaborativeText:text,readonly:false}})
  try{
   const editor=wrapper.vm as unknown as {goToMatch:(line:number,col:number,len:number)=>void;insertBlock:(value:string)=>boolean;runUndo:(redo:boolean)=>boolean}
   Y.applyUpdate(peer,Y.encodeStateAsUpdate(doc))
   editor.goToMatch(1,1,0)
   expect(editor.insertBlock('local')).toBe(true)
   const other=peer.getText('source')
   other.insert(other.length,' remote')
   other.delete(0,1)
   Y.applyUpdate(doc,Y.encodeStateAsUpdate(peer),'server')
   await nextTick()
   expect(text.toString()).toBe('local\nerver text remote')
   expect(editor.runUndo(false)).toBe(true)
   expect(text.toString()).toBe('erver text remote')
   expect(editor.runUndo(true)).toBe(true)
   expect(text.toString()).toBe('local\nerver text remote')
   expect(wrapper.emitted('update:modelValue')).toBeUndefined()
   await wrapper.setProps({readonly:true})
   expect(editor.runUndo(false)).toBe(false)
   expect(text.toString()).toBe('local\nerver text remote')
  }finally{wrapper.unmount();doc.destroy();peer.destroy()}
 })
 it('never tracks restored or remote transactions and blocks undo immediately on a session fence',async()=>{
  const doc=new Y.Doc(),text=markRaw(doc.getText('source'))
  text.insert(0,'initial')
  let authorized=true
  const wrapper=mount(LatexEditor,{props:{modelValue:text.toString(),collaborativeText:text,readonly:false,canEditCollaboration:()=>authorized}})
  try{
   const editor=wrapper.vm as unknown as {goToMatch:(line:number,col:number,len:number)=>void;insertBlock:(value:string)=>boolean;runUndo:(redo:boolean)=>boolean}
   text.insert(0,'recovered ')
   await nextTick()
   expect(wrapper.findAll('button').find(b=>b.text()==='撤销')?.attributes('disabled')).toBeDefined()
   editor.goToMatch(1,1,0);expect(editor.insertBlock('local')).toBe(true)
   const edited=text.toString()
   authorized=false
   expect(editor.runUndo(false)).toBe(false)
   expect(editor.insertBlock('forbidden')).toBe(false)
   expect(text.toString()).toBe(edited)
   authorized=true
   expect(editor.runUndo(false)).toBe(true)
   expect(text.toString()).toBe('recovered initial')
  }finally{wrapper.unmount();doc.destroy()}
 })
})


describe('Realtime source diagnostics',()=>{
 it('marks live problems, jumps to the range and clears compile diagnostics immediately on a source edit',async()=>{
  const source='before }\nsecond line'
  const wrapper=mount(LatexEditor,{props:{modelValue:source,filePath:'main.tex',compileDiagnostics:[{tool:'latex',file:'main.tex',line:2,message:'Undefined control sequence.'}]}})
  try{
   expect(wrapper.findAll('.cm-lintRange-error').length).toBeGreaterThanOrEqual(2)
   await wrapper.get('button[aria-label="源码检查"]').trigger('click')
   expect(wrapper.get('.latex-lint-panel').text()).toContain('Undefined control sequence.')
   expect(wrapper.get('.latex-lint-panel').text()).toContain('右花括号')
   await wrapper.findAll('.latex-lint-panel__row')[0]!.trigger('click')
   expect(wrapper.text()).toContain('行 1')
   await wrapper.setProps({modelValue:'Fixed source',compileDiagnostics:[]})
   expect(wrapper.find('.cm-lintRange-error').exists()).toBe(false)
   await vi.waitFor(()=>expect(wrapper.get('.latex-lint-panel').text()).toContain('未发现当前检查范围内的问题'),{timeout:1500})
   expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  }finally{wrapper.unmount()}
 })
 it('keeps cross-file checks explicit and discards old results after manifest changes',async()=>{
  const row={id:'chapter',path:'chapter.tex',kind:'text' as const,revision:1,sha256:''}
  let finish!:(result:{labels:string[];citations:string[];truncated:boolean})=>void
  const check=vi.fn().mockImplementationOnce(()=>new Promise(r=>{finish=r})).mockResolvedValueOnce({labels:['known'],citations:[],truncated:false})
  const wrapper=mount(LatexEditor,{props:{modelValue:String.raw`\ref{known} \ref{absent}`,filePath:'main.tex',completionFiles:[row],checkProjectReferences:check}})
  try{
   await wrapper.get('button[aria-label="源码检查"]').trigger('click')
   expect(check).not.toHaveBeenCalled()
   await wrapper.findAll('button').find(b=>b.text()==='检查项目引用')!.trigger('click')
   expect(check).toHaveBeenCalledTimes(1)
   await wrapper.setProps({completionFiles:[{...row,revision:2}]})
   finish({labels:[],citations:[],truncated:false});await flushPromises()
   expect(wrapper.get('.latex-lint-panel').text()).not.toContain('项目静态索引中未找到')
   await wrapper.findAll('button').find(b=>b.text()==='检查项目引用')!.trigger('click');await flushPromises()
   expect(check).toHaveBeenCalledTimes(2)
   expect(wrapper.get('.latex-lint-panel').text()).toContain('项目静态索引中未找到标签 absent')
   expect(wrapper.get('.latex-lint-panel').text()).not.toContain('未找到标签 known')
   await wrapper.setProps({completionFiles:[{...row,revision:3}]})
   expect(wrapper.find('.cm-lintRange-warning').exists()).toBe(false)
  }finally{wrapper.unmount()}
 })
 it('updates local markers for authoritative collaboration changes without ordinary saves',async()=>{
  const doc=new Y.Doc(),text=markRaw(doc.getText('source'))
  text.insert(0,'}')
  const wrapper=mount(LatexEditor,{props:{modelValue:'stale',filePath:'main.tex',collaborativeText:text,readonly:true}})
  try{
   expect(wrapper.find('.cm-lintRange-error').exists()).toBe(true)
   text.delete(0,1);text.insert(0,'clean')
   await nextTick()
   expect(wrapper.find('.cm-lintRange-error').exists()).toBe(false)
   await wrapper.get('button[aria-label="源码检查"]').trigger('click')
   await vi.waitFor(()=>expect(wrapper.get('.latex-lint-panel').text()).toContain('未发现当前检查范围内的问题'),{timeout:1500})
   expect(wrapper.emitted('update:modelValue')).toBeUndefined()
   expect(text.toString()).toBe('clean')
  }finally{wrapper.unmount();doc.destroy()}
 })
})
