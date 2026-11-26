import {describe,it,expect} from 'vitest'
import {readFileSync,readdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {mount} from '@vue/test-utils'
import PCheckbox from '@/components/ui/PCheckbox.vue'
describe('Papers shared UI controls',()=>{
 it('uses shared components for every visible form control and button',()=>{
  const root=resolve(__dirname,'../../../..')
  for(const directory of ['src/components/papers','src/views/papers']){
   for(const name of readdirSync(resolve(root,directory)).filter(n=>n.endsWith('.vue'))){
    const template=readFileSync(resolve(root,directory,name),'utf8').split('<script')[0]!
    const remaining=template.match(/<(?:input|textarea|select|button)\b[^>]*>/g)||[]
    for(const element of remaining)expect(element.includes('type="file"')&&element.includes('hidden')||element.includes('papers-workspace__files-backdrop'),name+': '+element).toBe(true)
   }
  }
 })
 it('provides a controlled accessible checkbox',async()=>{
  const w=mount(PCheckbox,{props:{modelValue:false,label:'Approve change'}})
  try{
   const box=w.get('input')
   expect((box.element as HTMLInputElement).checked).toBe(false)
   await box.setValue(true)
   expect(w.emitted('update:modelValue')).toEqual([[true]])
   await w.setProps({modelValue:true,disabled:true})
   expect((box.element as HTMLInputElement).checked).toBe(true)
   expect(box.attributes('disabled')).toBeDefined()
  }finally{w.unmount()}
 })
})
